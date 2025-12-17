# Quick Test: Excel File Upload

## ✅ Upload Functionality Status: **WORKING**

The upload system is implemented and ready to test. Here's how to verify it:

## Step-by-Step Test

### 1. Access Admin Panel
- **URL:** http://localhost:3000/admin
- **Login:** 
  - Username: `admin`
  - Password: `admin123`

### 2. Prepare Test Excel File

**Option A: Use Sample CSV (Convert to Excel)**
- I've created `test-data-sample.csv` with sample data
- Open it in Excel and save as `.xlsx` format

**Option B: Create Your Own**
- Create Excel file with these columns:
  - **First Name** (required)
  - **Last Name** (required)  
  - **Ticket Number** (required, unique)
  - Order ID (optional)
  - Email (optional)
  - Phone (optional)
  - Date (optional)

### 3. Upload File
1. In admin panel, find "Upload Excel Files" section
2. Click "Choose Files" button
3. Select your `.xlsx` or `.xls` file
4. Click "Upload Files" button
5. Wait for success message

### 4. Verify Upload Worked
✅ **Success Indicators:**
- Green success message appears
- "Data Preview" shows your entries
- Entry count updates
- Can search/filter entries
- Go to http://localhost:3000 - wheel shows your names

## Expected Results

### ✅ Success Case
```
✅ "Upload successful! X entries loaded."
✅ Entries appear in data preview table
✅ Wheel updates with uploaded names
✅ Can search entries
✅ Can select fixed winner
```

### ❌ Error Cases (What to Check)

1. **"Not an Excel file"**
   - Ensure file extension is `.xlsx` or `.xls`
   - Try re-saving file as Excel format

2. **"Missing required columns"**
   - Check column names match (case-insensitive):
     - First Name / FirstName / first_name
     - Last Name / LastName / last_name
     - Ticket Number / TicketNumber / ticket_number

3. **"Duplicate ticket number"**
   - Each ticket must be unique
   - Check for duplicates in your file

4. **"Exceeds 3000 rows"**
   - Maximum 3000 rows per file
   - Split into multiple files if needed

## Testing Checklist

- [ ] Can login to admin panel
- [ ] File input accepts .xlsx files
- [ ] File input accepts .xls files
- [ ] Upload button is enabled when file selected
- [ ] Upload shows loading state
- [ ] Success message appears
- [ ] Entries appear in preview
- [ ] Wheel updates with new names
- [ ] Can upload multiple files
- [ ] Error messages show for invalid files

## Troubleshooting

### Upload Button Not Working
- Check browser console for errors (F12)
- Verify file is selected
- Check network tab for API errors

### File Not Uploading
- Check file size (< 10MB)
- Verify file format (.xlsx or .xls)
- Check server console for errors

### Entries Not Showing
- Refresh admin panel
- Check "Data Preview" section
- Verify file was parsed correctly

## Sample Data Format

See `test-data-sample.csv` for example. It contains:
- 8 sample entries
- All required columns
- Unique ticket numbers
- Proper format

Convert CSV to Excel:
1. Open CSV in Excel
2. File → Save As
3. Choose "Excel Workbook (.xlsx)"
4. Save

## Next Steps After Upload

1. **Test Wheel:** Go to http://localhost:3000 and spin
2. **Test Fixed Winner:** Select winner index in admin panel
3. **Test Search:** Use search box to find entries
4. **Test Multiple Files:** Upload second file to combine entries

---

**Ready to test?** Follow the steps above and let me know if you encounter any issues!

