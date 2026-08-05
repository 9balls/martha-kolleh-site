// Run this with: npm run set-password
// It asks you to type a password, then prints a hash to paste into your .env
// file as ADMIN_PASSWORD_HASH. Your real password is never stored anywhere.

const readline = require('readline');
const bcrypt = require('bcryptjs');

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

rl.question('Choose an admin password (min 8 characters): ', (password) => {
  if (!password || password.length < 8) {
    console.log('\nPassword too short. Please use at least 8 characters. Run this again.');
    rl.close();
    process.exit(1);
  }
  const hash = bcrypt.hashSync(password, 12);
  console.log('\nAdd this line to your .env file:\n');
  console.log(`ADMIN_PASSWORD_HASH=${hash}\n`);
  rl.close();
});
