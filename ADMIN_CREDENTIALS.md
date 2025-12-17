# Admin Credentials

## Default Admin Login

**URL:** http://localhost:3000/admin

**Credentials:**
- **Username:** `admin`
- **Password:** `admin123`

## Changing Credentials

To change the admin credentials, edit the `.env.local` file:

```env
ADMIN_USERNAME=your_new_username
ADMIN_PASSWORD=your_new_password
```

Then restart the development server.

## Production Deployment

⚠️ **IMPORTANT:** Change these credentials before deploying to production!

Set environment variables in Vercel:
- `ADMIN_USERNAME` = your secure username
- `ADMIN_PASSWORD` = your secure password (use a strong password!)
- `SESSION_SECRET` = random 32+ character string

## Security Notes

- Never commit `.env.local` to Git
- Use strong passwords in production
- Consider using password managers
- Rotate credentials regularly

