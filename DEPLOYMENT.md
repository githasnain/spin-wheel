# Deployment Guide - Wheel Spinner Application

## Quick Start

### 1. Prerequisites

- Node.js 18+ installed
- Vercel account (free tier works)
- Excel files ready for upload

### 2. Local Development

```bash
# Install dependencies
npm install

# Set environment variables
cp .env.example .env.local
# Edit .env.local with your admin credentials

# Run development server
npm run dev

# Open http://localhost:3000
```

### 3. Deploy to Vercel

#### Option A: Vercel CLI

```bash
# Install Vercel CLI
npm i -g vercel

# Login to Vercel
vercel login

# Deploy
vercel

# Set environment variables
vercel env add ADMIN_USERNAME
vercel env add ADMIN_PASSWORD
vercel env add NODE_ENV production

# Deploy to production
vercel --prod
```

#### Option B: GitHub Integration

1. Push code to GitHub repository
2. Go to [Vercel Dashboard](https://vercel.com/dashboard)
3. Click "New Project"
4. Import your GitHub repository
5. Configure:
   - Framework Preset: Next.js
   - Root Directory: `./` (root)
   - Build Command: `npm run build`
   - Output Directory: `.next`
6. Add Environment Variables:
   - `ADMIN_USERNAME` = your admin username
   - `ADMIN_PASSWORD` = your secure password
   - `NODE_ENV` = `production`
7. Click "Deploy"

### 4. Post-Deployment

1. **Access Admin Panel:**
   - Go to `https://your-domain.vercel.app/admin`
   - Login with credentials from environment variables

2. **Upload Excel Files:**
   - Click "Choose Files" in admin panel
   - Select one or more Excel files (.xlsx or .xls)
   - Click "Upload Files"
   - Verify entries appear in data preview

3. **Test Wheel:**
   - Go to `https://your-domain.vercel.app` (public page)
   - Click wheel to spin
   - Verify winner is displayed

4. **Test Fixed Winner:**
   - In admin panel, select "Fixed Winner" mode
   - Enter winner index (0-based)
   - Click wheel to spin
   - Verify wheel lands on selected winner

## Environment Variables

Required environment variables:

```bash
ADMIN_USERNAME=admin              # Admin login username
ADMIN_PASSWORD=secure_password   # Admin login password (use strong password!)
NODE_ENV=production              # Environment (production/development)
```

**Security Notes:**
- Use a strong password for `ADMIN_PASSWORD`
- Never commit `.env` files to Git
- Rotate passwords regularly
- Consider using Vercel's environment variable encryption

## Excel File Format

Your Excel files must contain these columns (case-insensitive):

| Column Name | Required | Description |
|------------|----------|-------------|
| Order ID | No | Order identifier |
| First Name | **Yes** | Participant first name |
| Last Name | **Yes** | Participant last name |
| Email | No | Email address |
| Phone | No | Phone number |
| Ticket Number | **Yes** | Unique ticket identifier |
| Date | No | Purchase/registration date |

**Example Excel Structure:**
```
Order ID | First Name | Last Name | Email              | Phone       | Ticket Number | Date
---------|------------|-----------|-------------------|-------------|--------------|----------
ORD001   | John       | Doe       | john@example.com  | 555-1234    | TKT001       | 2024-01-01
ORD002   | Jane       | Smith     | jane@example.com  | 555-5678    | TKT002       | 2024-01-02
```

**Requirements:**
- Maximum 3000 rows per file
- Ticket Number must be unique
- First Name + Last Name will be displayed on wheel
- Multiple files can be uploaded (combined, max 3000 total)

## Troubleshooting

### Build Fails

**Error: Module not found**
```bash
# Clear cache and reinstall
rm -rf node_modules .next
npm install
npm run build
```

**Error: TypeScript errors**
- Check `tsconfig.json` includes all necessary paths
- Ensure `allowJs: true` for JavaScript files

### Runtime Errors

**Admin login fails:**
- Verify environment variables are set correctly
- Check `ADMIN_USERNAME` and `ADMIN_PASSWORD` match
- Clear browser cookies and try again

**Excel upload fails:**
- Verify file format (.xlsx or .xls)
- Check required columns exist
- Ensure file size < 10MB
- Check browser console for detailed errors

**Wheel not displaying:**
- Verify entries are loaded (`/api/wheel/entries` returns data)
- Check browser console for errors
- Ensure `names` array is not empty

### Performance Issues

**Slow Excel parsing:**
- Large files (>1000 rows) may take a few seconds
- Consider splitting into multiple smaller files
- Check server logs for timeout errors

**Wheel animation lag:**
- Ensure browser supports Canvas API
- Check for other heavy processes running
- Verify `requestAnimationFrame` is working

## Monitoring

### Vercel Analytics

Enable Vercel Analytics in dashboard:
1. Go to Project Settings
2. Enable "Analytics"
3. View metrics in dashboard

### Logs

View server logs:
```bash
vercel logs
```

Or in Vercel dashboard:
- Go to project
- Click "Deployments"
- Click on deployment
- View "Functions" logs

## Scaling Considerations

### Current Limitations

- **In-memory storage:** Data lost on server restart
- **Single server:** No horizontal scaling
- **No persistence:** Data not saved between deployments

### Upgrade Path

For production use with persistence:

1. **Add Database:**
   - Use Vercel Postgres (recommended)
   - Or MongoDB Atlas
   - Update `lib/storage.ts` to use database

2. **Add Caching:**
   - Use Vercel Edge Config
   - Cache wheel entries for faster loads

3. **Add Monitoring:**
   - Set up error tracking (Sentry)
   - Monitor API response times
   - Track user activity

## Support

For issues or questions:
1. Check README.md for architecture details
2. Review code comments in `lib/wheel-physics.ts`
3. Check Vercel deployment logs
4. Verify environment variables are set

## Security Checklist

- [ ] Strong `ADMIN_PASSWORD` set
- [ ] Environment variables not committed to Git
- [ ] HTTPS enabled (automatic on Vercel)
- [ ] HttpOnly cookies enabled (automatic)
- [ ] Session expiration set (24 hours)
- [ ] File upload validation enabled
- [ ] API routes protected with authentication

## Next Steps

After successful deployment:

1. Test all features:
   - [ ] Admin login
   - [ ] Excel upload
   - [ ] Random spin
   - [ ] Fixed winner spin
   - [ ] Public wheel display

2. Customize:
   - Update admin credentials
   - Adjust session duration if needed
   - Modify wheel colors/styles

3. Monitor:
   - Check Vercel analytics
   - Review error logs
   - Monitor API performance

