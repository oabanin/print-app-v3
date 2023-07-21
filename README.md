<img src=".erb/img/erb-banner.svg" width="100%" />

<br>

<p>
  Electron React Boilerplate uses <a href="https://electron.atom.io/">Electron</a>, <a href="https://facebook.github.io/react/">React</a>, <a href="https://github.com/reactjs/react-router">React Router</a>, <a href="https://webpack.js.org/">Webpack</a> and <a href="https://www.npmjs.com/package/react-refresh">React Fast Refresh</a>.
</p>

<br>


## Install

Clone the repo and install dependencies:

```bash
npm install
```


## Starting Development

Start the app in the `dev` environment:

```bash
npm start
```

## Packaging for Production

Each version needs to be packaged on the platform where it'll be used. For Windows, build on Windows, for MacOS, build on a mac.

Command: `yarn package`. Installer will be generated in the `release/build` folder.

The new files will need to be uploaded to S3 and need to update the links inside the app UI as well.

To package apps for the local platform:

```bash
npm run package
```

## Testing

- Look for the `BACKEND` variable to switch which environment the app connects to for testing.

- If you are on macOS, you can use VirtualBox for testing and packaging on windows. This can help with setting up a Win 11 virtualbox (https://www.minitool.com/news/how-to-install-windows-11-virtualbox.html). You may need to use fixes from this (https://www.minitool.com/news/this-pc-cant-run-windows-11-on-virtualbox.html). Easiest to share files between host and VM is to enable shared folders.

## Debugging

Logging provided by `electron-log`. Log file locations:

- macOS: ~/Library/Logs/outvio-printing-app/main.log
- Windows: %USERPROFILE%\AppData\Roaming\outvio-printing-app\logs\main.log


## Docs

See our [docs and guides here](https://electron-react-boilerplate.js.org/docs/installation)


## Raw Print
Send raw data to a printer by using the Win32 API [RAWPRN.EXE](https://learn.microsoft.com/en-us/troubleshoot/windows/win32/win32-raw-data-to-printer)
