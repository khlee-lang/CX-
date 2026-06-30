import { GoogleSpreadsheet } from 'google-spreadsheet';
import { JWT } from 'google-auth-library';
import { createRequire } from 'module';

const SPREADSHEET_ID = '1cqLifjcihpHlAUN9ZcG19uJ9MhdkYcOxLzMDPcaBufg';

export function createDoc() {
  let creds;
  if (process.env.GOOGLE_SERVICE_ACCOUNT_JSON) {
    creds = JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT_JSON);
  } else {
    const require = createRequire(import.meta.url);
    creds = require('../server/service-account.json');
  }

  const jwt = new JWT({
    email: creds.client_email,
    key: creds.private_key,
    scopes: [
      'https://www.googleapis.com/auth/spreadsheets',
      'https://www.googleapis.com/auth/drive.file',
    ],
  });

  return new GoogleSpreadsheet(SPREADSHEET_ID, jwt);
}
