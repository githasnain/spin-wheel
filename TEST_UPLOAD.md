# Testing Excel File Upload

## Quick Test Guide

### Step 1: Access Admin Panel
1. Go to: **http://localhost:3000/admin**
2. Login with:
   - Username: `admin`
   - Password: `admin123`

### Step 2: Create Test Excel File

You can use the sample CSV file (`test-data-sample.csv`) and convert it to Excel, or create your own.

**Required Columns:**
- First Name (required)
- Last Name (required)
- Ticket Number (required, must be unique)
- Order ID (optional)
- Email (optional)
- Phone (optional)
- Date (optional)

### Step 3: Upload File
1. In admin panel, click "Choose Files"
2. Select your Excel file (.xlsx or .xls)
3. Click "Upload Files"
4. Wait for success message

### Step 4: Verify Upload
1. Check "Data Preview" section - should show your entries
2. Go to public page: **http://localhost:3000**
3. Wheel should now show your uploaded names instead of defaults

## Expected Behavior

✅ **Success:**
- File uploads successfully
- Entries appear in data preview
- Wheel displays uploaded names
- Can search/filter entries

❌ **Common Issues:**

1. **"Not an Excel file"**
   - Ensure file is .xlsx or .xls format
   - Try saving as Excel format

2. **"Missing required columns"**
   - Check column names match exactly (case-insensitive)
   - Required: First Name, Last Name, Ticket Number

3. **"Duplicate ticket number"**
   - Each ticket number must be unique
   - Check for duplicates in your file

4. **"Exceeds 3000 rows"**
   - Maximum 3000 rows per file
   - Split into multiple files if needed

## Testing Checklist

- [ ] Can login to admin panel
- [ ] Can select Excel file
- [ ] Upload button works
- [ ] Success message appears
- [ ] Entries show in preview
- [ ] Wheel updates with new names
- [ ] Can search entries
- [ ] Can select fixed winner
- [ ] Wheel spins correctly

## Sample Data Format

See `test-data-sample.csv` for example format.

To convert CSV to Excel:
1. Open CSV in Excel
2. Save As → Excel Workbook (.xlsx)

