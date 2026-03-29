# Product 1 Testing

## Local test
```bash
cd product-1
bash install-test.sh
npm start
```
Open `http://localhost:4311`

## Share bundle
```bash
npm run prepare:share
```
Output:
- `dist/product-1-0.1.0.tar.gz`
- `dist/share-summary.json`

## Update flow test
In terminal 1:
```bash
npm start
```

In terminal 2:
```bash
npm run test:update-server
```

Then in UI:
1. set remote manifest to `http://127.0.0.1:4312/manifest.json`
2. click `Check updates`
3. click `Update now`
4. inspect status/backups

## Rollback test
- use the backup dropdown in the UI
- click rollback
