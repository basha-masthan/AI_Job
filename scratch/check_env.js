
const dotenv = require('dotenv');
dotenv.config({ path: '.env.local' });
console.log('GOOGLE_REDIRECT_URL:', process.env.GOOGLE_REDIRECT_URL);
console.log('GOOGLE_CLIENT_ID:', process.env.GOOGLE_CLIENT_ID);
