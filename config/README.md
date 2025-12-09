# config/

Configuration files for OpenRadar.

## Files

### `nodemon.json`
Configuration for nodemon (auto-reload in development).

```json
{
  "watch": ["app.js", "scripts/", "server-scripts/", "views/"],
  "ext": "js,ejs,json",
  "ignore": ["node_modules/", "dist/", "work/"]
}
```

**Usage:**
```bash
npm run dev  # Automatically uses this config
```

---

## 📝 Notes

This directory contains configuration files that don't need to be at the project root.

# scripts-shell/

Windows batch scripts to facilitate OpenRadar usage.

## Available Scripts

### `_INSTALL.bat`
Install project dependencies.

```bash
_INSTALL.bat
```

**Actions:**
- Check Node.js
- Install npm dependencies
- Rebuild native modules

---

### `_RUN.bat`
Run OpenRadar in production mode.

```bash
_RUN.bat
```

**Actions:**
- Run `npm start`
- Open browser at http://localhost:5001

---

## 📝 Notes

This directory contains Windows batch scripts for project setup and running. All instructions and comments are now in English for consistency.

**For development, prefer:**
```bash
npm run dev  # Auto-reload with nodemon
```
