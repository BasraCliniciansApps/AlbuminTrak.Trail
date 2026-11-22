'use strict';
// يضع أيقونة البرنامج ومعلومات الإصدار داخل ملف exe بدون الحاجة إلى Wine (يعمل على لينكس وويندوز)
const fs = require('fs');
const path = require('path');

exports.default = async function afterPack(context) {
  if (context.electronPlatformName !== 'win32') return;
  const ResEdit = await import('resedit');
  const exePath = path.join(context.appOutDir, `${context.packager.appInfo.productFilename}.exe`);
  const exe = ResEdit.NtExecutable.from(fs.readFileSync(exePath));
  const res = ResEdit.NtExecutableResource.from(exe);

  const iconFile = ResEdit.Data.IconFile.from(fs.readFileSync(path.join(__dirname, 'icon.ico')));
  const groups = ResEdit.Resource.IconGroupEntry.fromEntries(res.entries);
  const groupId = groups.length ? groups[0].id : 1;
  const lang = groups.length ? groups[0].lang : 1033;
  ResEdit.Resource.IconGroupEntry.replaceIconsForResource(res.entries, groupId, lang, iconFile.icons.map((i) => i.data));

  const vis = ResEdit.Resource.VersionInfo.fromEntries(res.entries);
  if (vis.length) {
    const vi = vis[0];
    const ver = context.packager.appInfo.version;
    const [maj, min, pat] = ver.split('.').map(Number);
    vi.setFileVersion(maj || 1, min || 0, pat || 0, 0, lang);
    vi.setProductVersion(maj || 1, min || 0, pat || 0, 0, lang);
    vi.setStringValues({ lang, codepage: 1200 }, {
      FileDescription: 'AlbuminTrak',
      ProductName: 'AlbuminTrak',
      InternalName: 'AlbuminTrak',
      OriginalFilename: 'AlbuminTrak.exe',
      CompanyName: 'AlbuminTrak',
      LegalCopyright: 'AlbuminTrak'
    });
    vi.outputToResourceEntries(res.entries);
  }
  res.outputResource(exe);
  fs.writeFileSync(exePath, Buffer.from(exe.generate()));
};
