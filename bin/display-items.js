const _ = require('lodash');
const fs = require('fs');
const path = require('path');
const utils = require('./utils');
const execSync = require('child_process').execSync;
const MarcRecord = require('marc-record-js');
const createRecordMerger = require('@natlibfi/marc-record-merge');
const PostMerge = require('melinda-deduplication-common/marc-record-merge-utils/marc-record-merge-postmerge-service');
const mergeConfiguration = require('./config/merge-config');

const datadir = path.resolve(process.argv[2]);
const skipCount = parseInt(process.argv[3] || 0);

const INTERACTIVE = true;

run().catch(error => console.error(error));

let itemIndex = 0;
async function run() {
  const items = utils.listItems(datadir).slice(skipCount);

  for (const itemFile of items) {
    itemIndex++;
    try {
      const item = await utils.openItem(path.resolve(datadir, itemFile));

      const preferredRecord = item.preferred;
      const otherRecord = item.other;

      const merge = createRecordMerger(mergeConfiguration);
      
      const postMergeFixes = PostMerge.preset.defaults;
    
      const mergedRecord = await merge(preferredRecord, otherRecord);
      const result = await PostMerge.applyPostMergeModifications(postMergeFixes, preferredRecord, otherRecord, mergedRecord);

      result.record.fields = result.record.fields.filter(f => f.tag !== '001');

      removeFields('583', result.record);
      removeFields('583', item.mergedModified);

      if (requiresInspection(result.record, item.mergedModified)) {
        console.log(`Item ${itemIndex} - ${itemFile} is not handled correctly`);

        if (INTERACTIVE) {
          fs.writeFileSync('/tmp/algorithm', result.record.toString());
          fs.writeFileSync('/tmp/human', item.mergedModified.toString());

          fs.writeFileSync('/tmp/preferred', preferredRecord.toString());
          fs.writeFileSync('/tmp/other', otherRecord.toString());

          console.log(item.meta);
          console.log('source records diff: /usr/bin/meld /tmp/preferred /tmp/other');
          execSync('/usr/bin/meld /tmp/algorithm /tmp/human');
        }
      } else {
        console.log(`Item ${itemIndex} - ${itemFile} is handled correctly`);
      }
    } catch(error) {
      console.log(`Failed to read ${itemIndex} - ${itemFile}`);
      console.error(`Failed to read ${itemIndex} - ${itemFile}`, error);
    }
  }
}

function fieldComp(a, b) {
  if (a.tag < b.tag) return 1;
  if (a.tag > b.tag) return -1;

  const getValue = (field) => _.concat(
    _.get(field, 'value', ''), 
    _.get(field, 'subfields', []).map(sub => sub.value)
  ).join('');

  if (getValue(a) < getValue(b)) return 1;
  if (getValue(a) > getValue(b)) return -1;
  
  return 0;
}

function requiresInspection(recordA, recordB) {
  const copyA = MarcRecord.clone(recordA);
  const copyB = MarcRecord.clone(recordB);
  
  copyA.fields.sort(fieldComp);
  copyB.fields.sort(fieldComp);

  return copyA.toString() != copyB.toString();
}

function removeFields(tag, record) {
  record.fields = record.fields.filter(f => f.tag !== tag);
}
