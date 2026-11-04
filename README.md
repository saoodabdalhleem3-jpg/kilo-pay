# Kilo Pay

A small iPhone web app for logging daily kilos and spending, and seeing pay and profit in shekels.
Pay is kilos × rate (1.3 to start). Profit is pay minus spending. All numbers stay on the phone.

## Run it on this computer

```
npm start
```

Then open http://localhost:8080

## Test

```
npm test
```

## Put it on the iPhone

1. Upload these files to a free static host such as GitHub Pages. It has to be `https`, or the app won't work offline.
2. Open the address in Safari on the iPhone.
3. Tap Share, then Add to Home Screen.
4. Always open the app from the home screen icon. Safari and the icon keep separate data.

## Changing the app later

Change `VERSION` in `sw.js` every time you change a file, or phones keep the old copy.

## Backups

Settings → Save a backup, then save the file to iCloud Drive or send it to yourself.
Restore from a backup replaces everything in the app with what's in the file.
