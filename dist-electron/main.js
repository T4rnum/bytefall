"use strict";
const electron = require("electron");
const path = require("node:path");
const fs = require("node:fs/promises");
process.env.DIST = path.join(__dirname, "../dist");
process.env.VITE_PUBLIC = electron.app.isPackaged ? process.env.DIST : path.join(__dirname, "../public");
let win;
const VITE_DEV_SERVER_URL = process.env["VITE_DEV_SERVER_URL"];
function createWindow() {
  const publicDir = process.env.VITE_PUBLIC || "";
  const distDir = process.env.DIST || "";
  win = new electron.BrowserWindow({
    width: 1200,
    height: 800,
    icon: path.join(publicDir, "electron-vite.svg"),
    webPreferences: {
      preload: path.join(__dirname, "preload.js")
    },
    autoHideMenuBar: true,
    backgroundColor: "#2e2c29"
  });
  win.setMenu(null);
  win.webContents.on("before-input-event", (event, input) => {
    if (input.type !== "keyDown") return;
    if (input.key === "F12" || input.control && input.shift && input.key.toLowerCase() === "i") {
      win == null ? void 0 : win.webContents.toggleDevTools();
      event.preventDefault();
    }
    if (input.key === "F5" || input.control && input.key.toLowerCase() === "r") {
      win == null ? void 0 : win.webContents.reload();
      event.preventDefault();
    }
  });
  win.webContents.on("did-finish-load", () => {
    win == null ? void 0 : win.webContents.send("main-process-message", (/* @__PURE__ */ new Date()).toLocaleString());
  });
  win.webContents.openDevTools();
  if (VITE_DEV_SERVER_URL) {
    const devServerUrl = VITE_DEV_SERVER_URL.replace("localhost", "127.0.0.1");
    console.log("Loading URL:", devServerUrl);
    const loadURL = () => {
      win == null ? void 0 : win.loadURL(devServerUrl).catch((err) => {
        console.log("Failed to load URL, retrying...", err);
        setTimeout(loadURL, 1e3);
      });
    };
    loadURL();
  } else {
    console.log("Loading file:", path.join(distDir, "index.html"));
    win.loadFile(path.join(distDir, "index.html"));
  }
}
electron.app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    electron.app.quit();
  }
});
electron.app.on("activate", () => {
  if (electron.BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});
electron.app.whenReady().then(() => {
  createWindow();
  electron.ipcMain.handle("save-project", async (_event, content) => {
    const { canceled, filePath } = await electron.dialog.showSaveDialog({
      filters: [{ name: "Bytefall Project", extensions: ["bfp", "json"] }]
    });
    if (canceled || !filePath) return { success: false };
    try {
      await fs.writeFile(filePath, content, "utf-8");
      return { success: true, filePath };
    } catch (error) {
      console.error("Failed to save file:", error);
      return { success: false, error };
    }
  });
  electron.ipcMain.handle("save-image", async (_event, dataUrl) => {
    const { canceled, filePath } = await electron.dialog.showSaveDialog({
      filters: [{ name: "PNG Image", extensions: ["png"] }]
    });
    if (canceled || !filePath) return { success: false };
    try {
      const base64Data = dataUrl.replace(/^data:image\/png;base64,/, "");
      await fs.writeFile(filePath, base64Data, "base64");
      return { success: true, filePath };
    } catch (error) {
      console.error("Failed to save image:", error);
      return { success: false, error };
    }
  });
  electron.ipcMain.handle("load-project", async () => {
    const { canceled, filePaths } = await electron.dialog.showOpenDialog({
      filters: [{ name: "Bytefall Project", extensions: ["bfp", "json"] }],
      properties: ["openFile"]
    });
    if (canceled || filePaths.length === 0) return { success: false };
    try {
      const content = await fs.readFile(filePaths[0], "utf-8");
      return { success: true, content, filePath: filePaths[0] };
    } catch (error) {
      console.error("Failed to load file:", error);
      return { success: false, error: String(error) };
    }
  });
});
