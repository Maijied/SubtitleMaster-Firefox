// If browser APIs don't exist, fallback to chrome.* 
if (typeof browser === "undefined") {
  var browser = chrome;
}
