const fs = require('fs');
const path = require('path');
const dir = path.join(__dirname, '../../assets/email');

const files = {
  smartLogo: 'smart-thumb.png',
  clockinLogo: 'icon-thumb.png',
  userIcon: 'user-icon.png',
  lockIcon: 'lock-icon.png',
  linkIcon: 'link-icon.png',
  eyeIcon: 'eye-icon.png',
  googlePlay: 'google-play.png',
  appStore: 'app-store.png'
};

const templatesDir = path.join(__dirname, '../../shared/templates');
if (!fs.existsSync(templatesDir)) {
  fs.mkdirSync(templatesDir, { recursive: true });
}

let content = '// Auto-generated email template image assets encoded as base64 buffers\n';
content += 'export const emailAssets = {\n';

for (const [key, filename] of Object.entries(files)) {
  const buf = fs.readFileSync(path.join(dir, filename));
  content += `  ${key}: Buffer.from('${buf.toString('base64')}', 'base64'),\n`;
}

content += '};\n';

fs.writeFileSync(path.join(templatesDir, 'welcome-email.assets.ts'), content);
console.log('welcome-email.assets.ts successfully generated!');
