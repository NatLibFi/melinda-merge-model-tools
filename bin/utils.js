const MarcRecord = require('marc-record-js');
const fs = require('fs');
const JSZip = require('jszip');

function listItems(itemsPath) {
  
  const files = fs.readdirSync(itemsPath);
  return files.sort();
}

async function openItem(itemPath) {
  
  const data = fs.readFileSync(itemPath);
  const zip = await JSZip.loadAsync(data);

  return readMergeFormat(zip);
}


async function readMergeFormat(zip) {

  const raw1 = await zip.file('preferred.txt').async('string');
  const raw2 = await zip.file('removed.txt').async('string');

  const rawMergedUnmodified = await zip.file('merged-unmodified.txt').async('string');
  const rawMergedModified = await zip.file('merged.txt').async('string');
  const rawMeta = await zip.file('meta.json').async('string');
  

  const preferred = MarcRecord.fromString(Buffer.from(raw1).toString('utf8'));
  const other = MarcRecord.fromString(Buffer.from(raw2).toString('utf8'));

  const mergedUnmodified = MarcRecord.fromString(Buffer.from(rawMergedUnmodified).toString('utf8'));
  const mergedModified = MarcRecord.fromString(Buffer.from(rawMergedModified).toString('utf8'));
  const meta = JSON.parse(rawMeta);

  undelete(preferred);
  undelete(other);
  return { 
    preferred, 
    other,
    mergedUnmodified,
    mergedModified,
    meta
  };
}
 
function undelete(record) {
  record.leader = record.leader.substring(0,5) + 'c' + record.leader.substring(6);
  record.fields = record.fields.filter(field => field.tag !== 'STA');
}

module.exports = {
  listItems,
  openItem
};
