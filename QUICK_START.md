# Quick Start Guide - Local Development

## ✅ Setup Complete!

The project is now set up and running locally.

## 🌐 Access the Application

### Public Wheel Page
- **URL:** http://localhost:3000
- **Description:** Public-facing wheel spinner (no entries until admin uploads Excel files)

### Admin Panel
- **URL:** http://localhost:3000/admin
- **Login Credentials:**
  - Username: `admin`
  - Password: `admin123`

## 📋 What You Can Do

### 1. Access Admin Panel
1. Go to http://localhost:3000/admin
2. Login with credentials above
3. Upload Excel files with participant data

### 2. Upload Excel Files
- Supported formats: `.xlsx`, `.xls`
- Required columns: First Name, Last Name, Ticket Number
- Optional columns: Order ID, Email, Phone, Date
- Maximum: 3000 rows per file

### 3. Test the Wheel
- Go to http://localhost:3000 (public page)
- Click the wheel to spin
- Try both random and fixed winner modes in admin panel

## 🔧 Environment Variables

The `.env.local` file has been created with default values:
- `ADMIN_USERNAME=admin`
- `ADMIN_PASSWORD=admin123`
- `SESSION_SECRET=local-dev-secret-key-change-in-production-min-32-chars`

**⚠️ Important:** Change these values before deploying to production!

## 🛠️ Development Commands

```bash
# Start development server
npm run dev

# Build for production
npm run build

# Start production server
npm start

# Run linter
npm run lint
```

## 📝 Excel File Format

Your Excel file should have these columns (case-insensitive):

| Column Name | Required | Example |
|------------|----------|---------|
| Order ID | No | ORD001 |
| First Name | **Yes** | John |
| Last Name | **Yes** | Doe |
| Email | No | john@example.com |
| Phone | No | 555-1234 |
| Ticket Number | **Yes** | TKT001 |
| Date | No | 2024-01-01 |

## 🐛 Troubleshooting

### Server won't start
- Check if port 3000 is already in use
- Try: `npm run dev` again
- Check console for errors

### Can't login to admin
- Verify `.env.local` file exists
- Check credentials match: `admin` / `admin123`
- Clear browser cookies and try again

### Excel upload fails
- Verify file format (.xlsx or .xls)
- Check required columns exist
- Ensure file size < 10MB
- Check browser console for errors

### Wheel not displaying
- Verify entries are loaded (check admin panel)
- Check browser console for errors
- Ensure JavaScript is enabled

## 📚 Next Steps

1. **Test Admin Panel:** Upload a test Excel file
2. **Test Wheel:** Spin the wheel on public page
3. **Test Fixed Winner:** Use admin panel to select a fixed winner
4. **Review Documentation:** Check `README.md` and `ARCHITECTURE.md`

## 🚀 Ready to Deploy?

See `DEPLOYMENT.md` for Vercel deployment instructions.

---

**Happy Coding! 🎡**

