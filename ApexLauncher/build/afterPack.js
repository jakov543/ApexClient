// electron-builder afterPack hook: sets the Apex icon + version info on "Apex Client.exe".
// Pure JavaScript (resedit), so it works when building on Windows, Linux or macOS — no Wine needed.
const fs = require('fs');
const path = require('path');

exports.default = async function afterPack(context) {
  if (context.electronPlatformName !== 'win32') return;
  const ResEdit = await import('resedit');
  const PE = await import('pe-library');
  const { productFilename } = context.packager.appInfo;
  const version = context.packager.appInfo.version;
  const exePath = path.join(context.appOutDir, `${productFilename}.exe`);
  const iconPath = path.join(context.packager.projectDir, 'build', 'icon.ico');

  const exe = PE.NtExecutable.from(fs.readFileSync(exePath), { ignoreCert: true });
  const res = PE.NtExecutableResource.from(exe);

  // icon
  const iconFile = ResEdit.Data.IconFile.from(fs.readFileSync(iconPath));
  const groups = ResEdit.Resource.IconGroupEntry.fromEntries(res.entries);
  const groupId = groups.length ? groups[0].id : 1;
  const groupLang = groups.length ? groups[0].lang : 1033;
  ResEdit.Resource.IconGroupEntry.replaceIconsForResource(
    res.entries, groupId, groupLang, iconFile.icons.map(i => i.data));

  // version info (what Windows shows in Properties / Task Manager)
  const [vi] = ResEdit.Resource.VersionInfo.fromEntries(res.entries);
  const [a, b, c] = version.split('.').map(Number);
  vi.setFileVersion(a, b, c, 0, 1033);
  vi.setProductVersion(a, b, c, 0, 1033);
  vi.setStringValues({ lang: 1033, codepage: 1200 }, {
    FileDescription: 'Apex Client',
    ProductName: 'Apex Client',
    CompanyName: 'Apex Client',
    LegalCopyright: 'Apex Client',
    OriginalFilename: `${productFilename}.exe`,
    InternalName: 'Apex Client'
  });
  vi.outputToResourceEntries(res.entries);

  res.outputResource(exe);
  fs.writeFileSync(exePath, Buffer.from(exe.generate()));
  console.log('  • Apex icon + version info written to', path.basename(exePath));
};
