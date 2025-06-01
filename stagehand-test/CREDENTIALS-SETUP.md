# Credentials Setup for SOP Execution

This guide explains how to securely provide credentials for your Gmail and Airtable SOP execution.

## 🔐 Security Options

### Option 1: Interactive Prompts (Recommended)
The safest option - you'll be prompted for credentials when running the SOP:

```bash
npm run test-your-sop
```

The system will ask for:
- Gmail email address
- Gmail password (or App Password)
- Airtable API key
- Airtable Base ID
- Airtable Table name

**Passwords are masked** and **credentials are only stored in memory** during execution.

### Option 2: Environment Variables
For repeated testing, you can set up a credentials file:

1. Copy the example file:
   ```bash
   cp sop-credentials.env.example sop-credentials.env
   ```

2. Edit `sop-credentials.env` with your credentials:
   ```env
   GMAIL_EMAIL=your_email@gmail.com
   GMAIL_PASSWORD=your_app_password
   AIRTABLE_API_KEY=your_api_key
   AIRTABLE_BASE_ID=your_base_id
   AIRTABLE_TABLE_NAME=your_table_name
   ```

3. Run the SOP:
   ```bash
   npm run test-your-sop
   ```

## 📧 Gmail Setup

### For Gmail with 2FA (Recommended):
1. Go to [Google Account Settings](https://myaccount.google.com/)
2. Navigate to Security → 2-Step Verification → App passwords
3. Generate an App Password for "Mail"
4. Use this App Password instead of your regular password

### For Gmail without 2FA:
- Use your regular Gmail password
- **Note**: Consider enabling 2FA for better security

## 🗃️ Airtable Setup

1. **API Key**: 
   - Go to [Airtable Account](https://airtable.com/account)
   - Find your API key in the "API" section

2. **Base ID**:
   - Open your Airtable base
   - Look at the URL: `https://airtable.com/appXXXXXXXXXXXXXX/...`
   - The `appXXXXXXXXXXXXXX` part is your Base ID

3. **Table Name**:
   - The name of the table in your base (e.g., "Investors", "Contacts")

## 🔒 Security Notes

- Credentials are **never logged** or saved to disk
- Memory is cleared after execution
- Use App Passwords for Gmail when possible
- Consider using environment variables for repeated testing
- The `sop-credentials.env` file is gitignored for security

## 🚀 Quick Start

1. **First time setup**:
   ```bash
   npm run test-your-sop
   ```
   Follow the interactive prompts.

2. **For repeated testing**, set up `sop-credentials.env` and run:
   ```bash
   npm run test-your-sop
   ```

## 🔧 Troubleshooting

- **Gmail login fails**: Use an App Password instead of your regular password
- **Airtable access fails**: Verify your API key and Base ID
- **SOP not found**: Ensure `latest-sop-v0.8.json` is in the correct location
- **Browser not visible**: Run `npm run browser-test` to debug browser visibility 