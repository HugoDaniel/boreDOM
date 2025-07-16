#!/usr/bin/env node
"use strict";
var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(
  // If the importer is in node compatibility mode or this is not an ESM
  // file that has been converted to a CommonJS file using a Babel-
  // compatible transform (i.e. "__esModule" has not been set), then set
  // "default" to the CommonJS "module.exports" for node compatibility.
  isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target,
  mod
));

// boreDOMCLI/generated_cli.js
var import_fs_extra = __toESM(require("fs-extra"));
var import_mime_types = __toESM(require("mime-types"));
var import_path = __toESM(require("path"));
var glob = __toESM(require("glob"));
var cheerio = __toESM(require("cheerio"));
var import_commander = require("commander");
var import_http = __toESM(require("http"));
var import_finalhandler = __toESM(require("finalhandler"));
var import_js_beautify = __toESM(require("js-beautify"));
var import_chokidar = __toESM(require("chokidar"));
var import_serve_handler = __toESM(require("serve-handler"));
var boredom = `
Ly8gc3JjL2RvbS50cwp2YXIgZHluYW1pY0ltcG9ydFNjcmlwdHMgPSBhc3luYyAobmFtZXMpID0+IHsKICBjb25zdCByZXN1bHQgPSAvKiBAX19QVVJFX18gKi8gbmV3IE1hcCgpOwogIGZvciAobGV0IGkgPSAwOyBpIDwgbmFtZXMubGVuZ3RoOyArK2kpIHsKICAgIGNvbnN0IHNjcmlwdExvY2F0aW9uID0gcXVlcnkoYHNjcmlwdFtzcmMqPSIke25hbWVzW2ldfSJdYCk/LmdldEF0dHJpYnV0ZSgKICAgICAgInNyYyIKICAgICk7CiAgICBsZXQgZiA9IG51bGw7CiAgICBpZiAoc2NyaXB0TG9jYXRpb24pIHsKICAgICAgdHJ5IHsKICAgICAgICBjb25zdCBleHBvcnRzID0gYXdhaXQgaW1wb3J0KHNjcmlwdExvY2F0aW9uKTsKICAgICAgICBmb3IgKGNvbnN0IGV4cG9ydGVkIG9mIE9iamVjdC5rZXlzKGV4cG9ydHMpKSB7CiAgICAgICAgICBmID0gZXhwb3J0c1tleHBvcnRlZF07CiAgICAgICAgICBicmVhazsKICAgICAgICB9CiAgICAgICAgcmVzdWx0LnNldChuYW1lc1tpXSwgZik7CiAgICAgIH0gY2F0Y2ggKGUpIHsKICAgICAgICBjb25zb2xlLmVycm9yKGBVbmFibGUgdG8gaW1wb3J0ICIke3NjcmlwdExvY2F0aW9ufSJgLCBlKTsKICAgICAgfQogICAgfQogIH0KICByZXR1cm4gcmVzdWx0Owp9Owp2YXIgc2VhcmNoRm9yQ29tcG9uZW50cyA9ICgpID0+IHsKICByZXR1cm4gQXJyYXkuZnJvbShxdWVyeUFsbCgidGVtcGxhdGVbZGF0YS1jb21wb25lbnRdIikpLmZpbHRlcigoZWxlbSkgPT4gZWxlbSBpbnN0YW5jZW9mIEhUTUxFbGVtZW50KS5tYXAoKHQpID0+IHsKICAgIGNvbnN0IHJlc3VsdCA9IHsKICAgICAgbmFtZTogIiIsCiAgICAgIGF0dHJpYnV0ZXM6IFtdCiAgICB9OwogICAgZm9yIChjb25zdCBhdHRyaWJ1dGUgaW4gdC5kYXRhc2V0KSB7CiAgICAgIGlmIChhdHRyaWJ1dGUgPT09ICJjb21wb25lbnQiKSB7CiAgICAgICAgcmVzdWx0Lm5hbWUgPSB0LmRhdGFzZXRbYXR0cmlidXRlXSA/PyAiIjsKICAgICAgfSBlbHNlIHsKICAgICAgICByZXN1bHQuYXR0cmlidXRlcy5wdXNoKFsKICAgICAgICAgIGRlY2FtZWxpemUoYXR0cmlidXRlKSwKICAgICAgICAgIHQuZGF0YXNldFthdHRyaWJ1dGVdID8/ICIiCiAgICAgICAgXSk7CiAgICAgIH0KICAgIH0KICAgIGlmIChyZXN1bHQubmFtZSA9PT0gIiIpIHsKICAgICAgdGhyb3cgbmV3IEVycm9yKAogICAgICAgIGBBIDx0ZW1wbGF0ZT4gd2FzIGZvdW5kIHdpdGggYW4gaW52YWxpZCBkYXRhLWNvbXBvbmVudDogIiR7dC5kYXRhc2V0LmNvbXBvbmVudH0iYAogICAgICApOwogICAgfQogICAgcmV0dXJuIHJlc3VsdDsKICB9KS5tYXAoKHsgbmFtZSwgYXR0cmlidXRlcyB9KSA9PiB7CiAgICBjb21wb25lbnQobmFtZSwgeyBhdHRyaWJ1dGVzIH0pOwogICAgcmV0dXJuIG5hbWU7CiAgfSk7Cn07CnZhciBjcmVhdGVDb21wb25lbnQgPSAobmFtZSwgdXBkYXRlKSA9PiB7CiAgY29uc3QgZWxlbWVudCA9IGNyZWF0ZShuYW1lKTsKICBpZiAoIWlzQm9yZWQoZWxlbWVudCkpIHsKICAgIGNvbnN0IGVycm9yID0gYFRoZSB0YWcgbmFtZSAiJHtuYW1lfSIgaXMgbm90IGEgQm9yZURPTSAgY29tcG9uZW50LgogICAgICAKImNyZWF0ZUNvbXBvbmVudCIgb25seSBhY2NlcHRzIHRhZy1uYW1lcyB3aXRoIG1hdGNoaW5nIDx0ZW1wbGF0ZT4gdGFncyB0aGF0IGhhdmUgYSBkYXRhLWNvbXBvbmVudCBhdHRyaWJ1dGUgaW4gdGhlbS5gOwogICAgY29uc29sZS5lcnJvcihlcnJvcik7CiAgICB0aHJvdyBuZXcgRXJyb3IoZXJyb3IpOwogIH0KICBpZiAodXBkYXRlKSB7CiAgICBlbGVtZW50LnJlbmRlckNhbGxiYWNrID0gdXBkYXRlOwogIH0KICByZXR1cm4gZWxlbWVudDsKfTsKdmFyIHF1ZXJ5Q29tcG9uZW50ID0gKHEpID0+IHsKICBjb25zdCBlbGVtID0gcXVlcnkocSk7CiAgaWYgKGVsZW0gPT09IG51bGwgfHwgIWlzQm9yZWQoZWxlbSkpIHsKICAgIHJldHVybiB2b2lkIDA7CiAgfQogIHJldHVybiBlbGVtOwp9Owp2YXIgcXVlcnkgPSAocXVlcnkyKSA9PiBkb2N1bWVudC5xdWVyeVNlbGVjdG9yKHF1ZXJ5Mik7CnZhciBxdWVyeUFsbCA9IChxdWVyeTIpID0+IGRvY3VtZW50LnF1ZXJ5U2VsZWN0b3JBbGwocXVlcnkyKTsKdmFyIGNyZWF0ZSA9ICh0YWdOYW1lLCBjaGlsZHJlbikgPT4gewogIGNvbnN0IGUgPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KHRhZ05hbWUpOwogIGlmIChjaGlsZHJlbiAmJiBBcnJheS5pc0FycmF5KGNoaWxkcmVuKSAmJiBjaGlsZHJlbi5sZW5ndGggPiAwKSB7CiAgICBjaGlsZHJlbi5tYXAoKGMpID0+IGUuYXBwZW5kQ2hpbGQoYykpOwogIH0KICByZXR1cm4gZTsKfTsKdmFyIGRpc3BhdGNoID0gKG5hbWUsIGRldGFpbCkgPT4gewogIGlmIChkb2N1bWVudC5yZWFkeVN0YXRlID09PSAibG9hZGluZyIpIHsKICAgIGFkZEV2ZW50TGlzdGVuZXIoCiAgICAgICJET01Db250ZW50TG9hZGVkIiwKICAgICAgKCkgPT4gZGlzcGF0Y2hFdmVudChuZXcgQ3VzdG9tRXZlbnQobmFtZSwgeyBkZXRhaWwgfSkpCiAgICApOwogIH0gZWxzZSB7CiAgICBkaXNwYXRjaEV2ZW50KG5ldyBDdXN0b21FdmVudChuYW1lLCB7IGRldGFpbCB9KSk7CiAgfQp9Owp2YXIgaXNPYmplY3QgPSAodCkgPT4gdHlwZW9mIHQgPT09ICJvYmplY3QiOwp2YXIgaXNGdW5jdGlvbiA9ICh0KSA9PiB0eXBlb2YgdCA9PT0gImZ1bmN0aW9uIjsKdmFyIGlzQm9yZWQgPSAodCkgPT4gaXNPYmplY3QodCkgJiYgImlzQm9yZWQiIGluIHQgJiYgQm9vbGVhbih0LmlzQm9yZWQpOwp2YXIgZGVjYW1lbGl6ZSA9IChzdHIpID0+IHsKICBpZiAoc3RyID09PSAiIiB8fCAhc3RyLnNwbGl0KCIiKS5zb21lKChjaGFyKSA9PiBjaGFyICE9PSBjaGFyLnRvTG93ZXJDYXNlKCkpKSB7CiAgICByZXR1cm4gc3RyOwogIH0KICBsZXQgcmVzdWx0ID0gIiI7CiAgZm9yIChsZXQgaSA9IDA7IGkgPCBzdHIubGVuZ3RoOyBpKyspIHsKICAgIGNvbnN0IGNoYXIgPSBzdHJbaV07CiAgICBpZiAoY2hhciA9PT0gY2hhci50b1VwcGVyQ2FzZSgpICYmIGkgIT09IDApIHsKICAgICAgcmVzdWx0ICs9ICItIjsKICAgIH0KICAgIHJlc3VsdCArPSBjaGFyLnRvTG93ZXJDYXNlKCk7CiAgfQogIHJldHVybiByZXN1bHQ7Cn07CnZhciBpc1N0YXJ0c1dpdGhPbiA9IChzKSA9PiBzLnN0YXJ0c1dpdGgoIm9uIik7CnZhciBpc1N0YXJ0c1dpdGhRdWVyaWVkT24gPSAocykgPT4gcy5zdGFydHNXaXRoKCJxdWVyaWVkT24iKTsKdmFyIGdldEV2ZW50TmFtZSA9IChzKSA9PiB7CiAgaWYgKGlzU3RhcnRzV2l0aE9uKHMpKSB7CiAgICByZXR1cm4gcy5zbGljZSgyKS50b0xvd2VyQ2FzZSgpOwogIH0KICByZXR1cm4gcy5zbGljZSg5KS50b0xvd2VyQ2FzZSgpOwp9Owp2YXIgQm9yZWQgPSBjbGFzcyBleHRlbmRzIEhUTUxFbGVtZW50IHsKfTsKdmFyIGNvbXBvbmVudCA9ICh0YWcsIHByb3BzID0ge30pID0+IHsKICBpZiAoY3VzdG9tRWxlbWVudHMuZ2V0KHRhZykpIHJldHVybjsKICBjdXN0b21FbGVtZW50cy5kZWZpbmUoCiAgICB0YWcsCiAgICBjbGFzcyBleHRlbmRzIEJvcmVkIHsKICAgICAgLy8gU3BlY2lmeSBvYnNlcnZlZCBhdHRyaWJ1dGVzIHNvIHRoYXQKICAgICAgLy8gYXR0cmlidXRlQ2hhbmdlZENhbGxiYWNrIHdpbGwgd29yawogICAgICBzdGF0aWMgZ2V0IG9ic2VydmVkQXR0cmlidXRlcygpIHsKICAgICAgICBpZiAodHlwZW9mIHByb3BzLmF0dHJpYnV0ZUNoYW5nZWRDYWxsYmFjayA9PT0gIm9iamVjdCIpIHsKICAgICAgICAgIHJldHVybiBPYmplY3Qua2V5cyhwcm9wcy5hdHRyaWJ1dGVDaGFuZ2VkQ2FsbGJhY2spOwogICAgICAgIH0KICAgICAgICByZXR1cm4gW107CiAgICAgIH0KICAgICAgY29uc3RydWN0b3IoKSB7CiAgICAgICAgc3VwZXIoKTsKICAgICAgfQogICAgICAvKioKICAgICAgICogVXNlZnVsIHRvIGtub3cgaWYgYSBnaXZlbiBIVE1MRWxlbWVudCBpcyBhIEJvcmVkIGNvbXBvbmVudC4KICAgICAgICogQHNlZSBgaXNCb3JlZCgpYCB0eXBlZ3VhcmQKICAgICAgICovCiAgICAgIGlzQm9yZWQgPSB0cnVlOwogICAgICB0cmF2ZXJzZShmLCB7IHRyYXZlcnNlU2hhZG93Um9vdCwgcXVlcnk6IHF1ZXJ5MiB9ID0ge30pIHsKICAgICAgICBBcnJheS5mcm9tKAogICAgICAgICAgdHJhdmVyc2VTaGFkb3dSb290ID8gdGhpcy5zaGFkb3dSb290Py5xdWVyeVNlbGVjdG9yQWxsKHF1ZXJ5MiA/PyAiKiIpID8/IFtdIDogW10KICAgICAgICApLmNvbmNhdChBcnJheS5mcm9tKHRoaXMucXVlcnlTZWxlY3RvckFsbChxdWVyeTIgPz8gIioiKSkpLmZpbHRlcigobikgPT4gbiBpbnN0YW5jZW9mIEhUTUxFbGVtZW50KS5mb3JFYWNoKGYpOwogICAgICB9CiAgICAgIC8qKgogICAgICAgKiBSZXR1cm5zIHRoZSBsaXN0IG9mIGN1c3RvbSBldmVudCBuYW1lcyBmcm9tIGEgc3RyaW5nIHRoYXQgaXMgc2hhcGVkIGxpa2U6CiAgICAgICAqIGAiZGlzcGF0Y2goJ2V2ZW50MScsICdldmVudDInLCAuLi4pImAKICAgICAgICoKICAgICAgICogVGhpcyBpcyB1c2VmdWwgd2hlbiB0cmF2ZXJzaW5nIGZvciBldmVudCBoYW5kbGVycyB0byBiZSByZXBsYWNlZAogICAgICAgKiB3aXRoIGN1c3RvbSBkaXNwYXRjaGVycy4KICAgICAgICogQHJldHVybnMgYW4gYXJyYXkgb2Ygc3RyaW5ncwogICAgICAgKi8KICAgICAgI3BhcnNlQ3VzdG9tRXZlbnROYW1lcyhzdHIpIHsKICAgICAgICByZXR1cm4gc3RyLnNwbGl0KCInIikuZmlsdGVyKAogICAgICAgICAgKHMpID0+IHMubGVuZ3RoID4gMiAmJiAhKHMuaW5jbHVkZXMoIigiKSB8fCBzLmluY2x1ZGVzKCIsIikgfHwgcy5pbmNsdWRlcygiKSIpKQogICAgICAgICk7CiAgICAgIH0KICAgICAgI2NyZWF0ZURpc3BhdGNoZXJzKCkgewogICAgICAgIGxldCBob3N0OwogICAgICAgIHRoaXMudHJhdmVyc2UoKG5vZGUpID0+IHsKICAgICAgICAgIGlmIChub2RlIGluc3RhbmNlb2YgSFRNTEVsZW1lbnQpIHsKICAgICAgICAgICAgY29uc3QgaXNXZWJDb21wb25lbnQgPSBjdXN0b21FbGVtZW50cy5nZXQoCiAgICAgICAgICAgICAgbm9kZS50YWdOYW1lLnRvTG93ZXJDYXNlKCkKICAgICAgICAgICAgKTsKICAgICAgICAgICAgaWYgKGlzV2ViQ29tcG9uZW50KSBob3N0ID0gbm9kZTsKICAgICAgICAgICAgZm9yIChsZXQgaSA9IDA7IGkgPCBub2RlLmF0dHJpYnV0ZXMubGVuZ3RoOyBpKyspIHsKICAgICAgICAgICAgICBjb25zdCBhdHRyaWJ1dGUgPSBub2RlLmF0dHJpYnV0ZXNbaV07CiAgICAgICAgICAgICAgaWYgKGlzU3RhcnRzV2l0aE9uKGF0dHJpYnV0ZS5uYW1lKSkgewogICAgICAgICAgICAgICAgY29uc3QgZXZlbnROYW1lcyA9IHRoaXMuI3BhcnNlQ3VzdG9tRXZlbnROYW1lcyhhdHRyaWJ1dGUudmFsdWUpOwogICAgICAgICAgICAgICAgaWYgKGV2ZW50TmFtZXMubGVuZ3RoID4gMCkgewogICAgICAgICAgICAgICAgICBldmVudE5hbWVzLmZvckVhY2goKGN1c3RvbUV2ZW50TmFtZSkgPT4gewogICAgICAgICAgICAgICAgICAgIG5vZGUuYWRkRXZlbnRMaXN0ZW5lcigKICAgICAgICAgICAgICAgICAgICAgIGdldEV2ZW50TmFtZShhdHRyaWJ1dGUubmFtZSksCiAgICAgICAgICAgICAgICAgICAgICAoZSkgPT4gZGlzcGF0Y2goY3VzdG9tRXZlbnROYW1lLCB7CiAgICAgICAgICAgICAgICAgICAgICAgIGV2ZW50OiBlLAogICAgICAgICAgICAgICAgICAgICAgICBkaXNwYXRjaGVyOiBub2RlLAogICAgICAgICAgICAgICAgICAgICAgICBjb21wb25lbnQ6IHRoaXMsCiAgICAgICAgICAgICAgICAgICAgICAgIGluZGV4OiB0aGlzLnBhcmVudEVsZW1lbnQgPyBBcnJheS5mcm9tKHRoaXMucGFyZW50RWxlbWVudC5jaGlsZHJlbikuaW5kZXhPZigKICAgICAgICAgICAgICAgICAgICAgICAgICB0aGlzCiAgICAgICAgICAgICAgICAgICAgICAgICkgOiAtMQogICAgICAgICAgICAgICAgICAgICAgfSkKICAgICAgICAgICAgICAgICAgICApOwogICAgICAgICAgICAgICAgICB9KTsKICAgICAgICAgICAgICAgIH0KICAgICAgICAgICAgICAgIG5vZGUuc2V0QXR0cmlidXRlKAogICAgICAgICAgICAgICAgICBgZGF0YS0ke2F0dHJpYnV0ZS5uYW1lfS1kaXNwYXRjaGVzYCwKICAgICAgICAgICAgICAgICAgZXZlbnROYW1lcy5qb2luKCkKICAgICAgICAgICAgICAgICk7CiAgICAgICAgICAgICAgICBub2RlLnJlbW92ZUF0dHJpYnV0ZShhdHRyaWJ1dGUubmFtZSk7CiAgICAgICAgICAgICAgfQogICAgICAgICAgICB9CiAgICAgICAgICB9CiAgICAgICAgfSwgeyB0cmF2ZXJzZVNoYWRvd1Jvb3Q6IHRydWUgfSk7CiAgICAgIH0KICAgICAgaXNJbml0aWFsaXplZCA9IGZhbHNlOwogICAgICAjaW5pdCgpIHsKICAgICAgICBsZXQgdGVtcGxhdGUgPSBxdWVyeShgW2RhdGEtY29tcG9uZW50PSIke3RhZ30iXWApID8/IGNyZWF0ZSgidGVtcGxhdGUiKTsKICAgICAgICBjb25zdCBpc1RlbXBsYXRlU2hhZG93Um9vdCA9IHRlbXBsYXRlLmdldEF0dHJpYnV0ZSgic2hhZG93cm9vdG1vZGUiKTsKICAgICAgICBjb25zdCBpc1NoYWRvd1Jvb3ROZWVkZWQgPSBwcm9wcy5zdHlsZSB8fCBwcm9wcy5zaGFkb3cgfHwgaXNUZW1wbGF0ZVNoYWRvd1Jvb3Q7CiAgICAgICAgaWYgKGlzU2hhZG93Um9vdE5lZWRlZCkgewogICAgICAgICAgY29uc3Qgc2hhZG93Um9vdE1vZGUgPSBwcm9wcy5zaGFkb3dyb290bW9kZSA/PyBpc1RlbXBsYXRlU2hhZG93Um9vdCA/PyAib3BlbiI7CiAgICAgICAgICBjb25zdCBzaGFkb3dSb290ID0gdGhpcy5hdHRhY2hTaGFkb3coeyBtb2RlOiBzaGFkb3dSb290TW9kZSB9KTsKICAgICAgICAgIGlmIChwcm9wcy5zdHlsZSkgewogICAgICAgICAgICBjb25zdCBzdHlsZSA9IGNyZWF0ZSgic3R5bGUiKTsKICAgICAgICAgICAgc3R5bGUudGV4dENvbnRlbnQgPSBwcm9wcy5zdHlsZTsKICAgICAgICAgICAgc2hhZG93Um9vdC5hcHBlbmRDaGlsZChzdHlsZSk7CiAgICAgICAgICB9CiAgICAgICAgICBpZiAocHJvcHMuc2hhZG93KSB7CiAgICAgICAgICAgIGNvbnN0IHRtcCA9IGNyZWF0ZSgidGVtcGxhdGUiKTsKICAgICAgICAgICAgdG1wLmlubmVySFRNTCA9IHByb3BzLnNoYWRvdzsKICAgICAgICAgICAgc2hhZG93Um9vdC5hcHBlbmRDaGlsZCh0bXAuY29udGVudC5jbG9uZU5vZGUodHJ1ZSkpOwogICAgICAgICAgfSBlbHNlIGlmIChpc1RlbXBsYXRlU2hhZG93Um9vdCkgewogICAgICAgICAgICBzaGFkb3dSb290LmFwcGVuZENoaWxkKHRlbXBsYXRlLmNvbnRlbnQuY2xvbmVOb2RlKHRydWUpKTsKICAgICAgICAgIH0KICAgICAgICB9CiAgICAgICAgaWYgKHRlbXBsYXRlICYmICFpc1RlbXBsYXRlU2hhZG93Um9vdCkgewogICAgICAgICAgdGhpcy5hcHBlbmRDaGlsZCh0ZW1wbGF0ZS5jb250ZW50LmNsb25lTm9kZSh0cnVlKSk7CiAgICAgICAgfQogICAgICAgIGlmIChwcm9wcy5vblNsb3RDaGFuZ2UpIHsKICAgICAgICAgIHRoaXMudHJhdmVyc2UoKGVsZW0pID0+IHsKICAgICAgICAgICAgaWYgKCEoZWxlbSBpbnN0YW5jZW9mIEhUTUxTbG90RWxlbWVudCkpIHJldHVybjsKICAgICAgICAgICAgZWxlbS5hZGRFdmVudExpc3RlbmVyKCJzbG90Y2hhbmdlIiwgKGUpID0+IHByb3BzLm9uU2xvdENoYW5nZT8uKGUpKTsKICAgICAgICAgIH0sIHsgdHJhdmVyc2VTaGFkb3dSb290OiB0cnVlIH0pOwogICAgICAgIH0KICAgICAgICBpZiAoaXNGdW5jdGlvbihwcm9wcy5vbkNsaWNrKSkgewogICAgICAgICAgdGhpcy5hZGRFdmVudExpc3RlbmVyKCJjbGljayIsIHByb3BzLm9uQ2xpY2spOwogICAgICAgIH0KICAgICAgICBmb3IgKGNvbnN0IFtrZXksIHZhbHVlXSBvZiBPYmplY3QuZW50cmllcyhwcm9wcykpIHsKICAgICAgICAgIGlmIChpc1N0YXJ0c1dpdGhPbihrZXkpKSB7CiAgICAgICAgICAgIGlmICghaXNGdW5jdGlvbih2YWx1ZSkpIGNvbnRpbnVlOwogICAgICAgICAgICB0aGlzLmFkZEV2ZW50TGlzdGVuZXIoZ2V0RXZlbnROYW1lKGtleSksIHZhbHVlKTsKICAgICAgICAgIH0gZWxzZSBpZiAoaXNTdGFydHNXaXRoUXVlcmllZE9uKGtleSkpIHsKICAgICAgICAgICAgY29uc3QgcXVlcmllcyA9IHZhbHVlOwogICAgICAgICAgICBpZiAoIWlzT2JqZWN0KHF1ZXJpZXMpKSBjb250aW51ZTsKICAgICAgICAgICAgY29uc3QgZXZlbnROYW1lID0gZ2V0RXZlbnROYW1lKGtleSk7CiAgICAgICAgICAgIGZvciAoY29uc3QgW3F1ZXJ5MiwgaGFuZGxlcl0gb2YgT2JqZWN0LmVudHJpZXMocXVlcmllcykpIHsKICAgICAgICAgICAgICB0aGlzLnRyYXZlcnNlKChub2RlKSA9PiB7CiAgICAgICAgICAgICAgICBub2RlLmFkZEV2ZW50TGlzdGVuZXIoZXZlbnROYW1lLCBoYW5kbGVyKTsKICAgICAgICAgICAgICB9LCB7IHRyYXZlcnNlU2hhZG93Um9vdDogdHJ1ZSwgcXVlcnk6IHF1ZXJ5MiB9KTsKICAgICAgICAgICAgfQogICAgICAgICAgfQogICAgICAgIH0KICAgICAgICBpZiAocHJvcHMuYXR0cmlidXRlcyAmJiBBcnJheS5pc0FycmF5KHByb3BzLmF0dHJpYnV0ZXMpKSB7CiAgICAgICAgICBwcm9wcy5hdHRyaWJ1dGVzLm1hcCgKICAgICAgICAgICAgKFthdHRyLCB2YWx1ZV0pID0+IHRoaXMuc2V0QXR0cmlidXRlKGF0dHIsIHZhbHVlKQogICAgICAgICAgKTsKICAgICAgICB9CiAgICAgICAgdGhpcy4jY3JlYXRlRGlzcGF0Y2hlcnMoKTsKICAgICAgICB0aGlzLmlzSW5pdGlhbGl6ZWQgPSB0cnVlOwogICAgICB9CiAgICAgIHJlbmRlckNhbGxiYWNrID0gKF8pID0+IHsKICAgICAgfTsKICAgICAgY29ubmVjdGVkQ2FsbGJhY2soKSB7CiAgICAgICAgaWYgKCF0aGlzLmlzSW5pdGlhbGl6ZWQpIHRoaXMuI2luaXQoKTsKICAgICAgICB0aGlzLnJlbmRlckNhbGxiYWNrKHRoaXMpOwogICAgICAgIHByb3BzLmNvbm5lY3RlZENhbGxiYWNrPy4odGhpcyk7CiAgICAgIH0KICAgICAgc2xvdHMgPSBjcmVhdGVTbG90c0FjY2Vzc29yKHRoaXMpOwogICAgICAvKgogICAgICAgICAgICAjY3JlYXRlU2xvdHMoKSB7CiAgICAgICAgICAgICAgY29uc3Qgc2xvdHMgPSBBcnJheS5mcm9tKHRoaXMucXVlcnlTZWxlY3RvckFsbCgic2xvdCIpKTsKICAgICAgICAgICAgICBjb25zdCB3ZWJDb21wb25lbnQgPSB0aGlzOwogICAgICAKICAgICAgICAgICAgICBzbG90cy5mb3JFYWNoKChzbG90KSA9PiB7CiAgICAgICAgICAgICAgICBjb25zdCBzbG90TmFtZSA9IHNsb3QuZ2V0QXR0cmlidXRlKCJuYW1lIik7CiAgICAgICAgICAgICAgICBpZiAoIXNsb3ROYW1lKSByZXR1cm47CiAgICAgIAogICAgICAgICAgICAgICAgY29uc3QgY2FtZWxpemVkU2xvdE5hbWUgPSBjYW1lbGl6ZShzbG90TmFtZSk7CiAgICAgICAgICAgICAgICBPYmplY3QuZGVmaW5lUHJvcGVydHkod2ViQ29tcG9uZW50LnNsb3RzLCBjYW1lbGl6ZWRTbG90TmFtZSwgewogICAgICAgICAgICAgICAgICBnZXQoKSB7CiAgICAgICAgICAgICAgICAgICAgcmV0dXJuIHdlYkNvbXBvbmVudC5xdWVyeVNlbGVjdG9yKGBbZGF0YS1zbG90PSIke3Nsb3ROYW1lfSJdYCk7CiAgICAgICAgICAgICAgICAgIH0sCiAgICAgICAgICAgICAgICAgIHNldCh2YWx1ZSkgewogICAgICAgICAgICAgICAgICAgIGxldCBlbGVtID0gdmFsdWU7CiAgICAgICAgICAgICAgICAgICAgaWYgKHZhbHVlIGluc3RhbmNlb2YgSFRNTEVsZW1lbnQpIHsKICAgICAgICAgICAgICAgICAgICAgIHZhbHVlLnNldEF0dHJpYnV0ZSgiZGF0YS1zbG90Iiwgc2xvdE5hbWUpOwogICAgICAgICAgICAgICAgICAgIH0gZWxzZSBpZiAodHlwZW9mIHZhbHVlID09PSAic3RyaW5nIikgewogICAgICAgICAgICAgICAgICAgICAgZWxlbSA9IGNyZWF0ZSgic3BhbiIpOwogICAgICAgICAgICAgICAgICAgICAgZWxlbS5zZXRBdHRyaWJ1dGUoImRhdGEtc2xvdCIsIHNsb3ROYW1lKTsKICAgICAgICAgICAgICAgICAgICAgIGVsZW0uaW5uZXJUZXh0ID0gdmFsdWU7CiAgICAgICAgICAgICAgICAgICAgfQogICAgICAKICAgICAgICAgICAgICAgICAgICBjb25zdCBleGlzdGluZ1Nsb3QgPSB0aGlzW2NhbWVsaXplZFNsb3ROYW1lXTsKICAgICAgICAgICAgICAgICAgICBpZiAoZXhpc3RpbmdTbG90KSB7CiAgICAgICAgICAgICAgICAgICAgICBleGlzdGluZ1Nsb3QucGFyZW50RWxlbWVudC5yZXBsYWNlQ2hpbGQoZWxlbSwgZXhpc3RpbmdTbG90KTsKICAgICAgICAgICAgICAgICAgICB9IGVsc2UgewogICAgICAgICAgICAgICAgICAgICAgc2xvdC5wYXJlbnRFbGVtZW50Py5yZXBsYWNlQ2hpbGQoZWxlbSwgc2xvdCk7CiAgICAgICAgICAgICAgICAgICAgfQogICAgICAgICAgICAgICAgICB9LAogICAgICAgICAgICAgICAgfSk7CiAgICAgICAgICAgICAgfSk7CiAgICAgICAgICAgIH0KICAgICAgICAgICAgKi8KICAgICAgdXBkYXRlU2xvdChzbG90TmFtZSwgY29udGVudCwgd2l0aGluVGFnKSB7CiAgICAgICAgY29uc3QgY29udGFpbmVyID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudCh3aXRoaW5UYWcpOwogICAgICAgIGNvbnRhaW5lci5zZXRBdHRyaWJ1dGUoInNsb3QiLCBzbG90TmFtZSk7CiAgICAgIH0KICAgICAgLyoKICAgICAgICAgICAgI2NyZWF0ZVByb3BlcnRpZXMoKSB7CiAgICAgICAgICAgICAgY29uc3QgZWxlbWVudHNGb3VuZCA9IGRvY3VtZW50LmV2YWx1YXRlKAogICAgICAgICAgICAgICAgIi8vKltjb250YWlucyh0ZXh0KCksJ3RoaXMuJyldIiwKICAgICAgICAgICAgICAgIGRvY3VtZW50LAogICAgICAgICAgICAgICAgbnVsbCwKICAgICAgICAgICAgICAgIFhQYXRoUmVzdWx0Lk9SREVSRURfTk9ERV9JVEVSQVRPUl9UWVBFLAogICAgICAgICAgICAgICAgbnVsbCwKICAgICAgICAgICAgICApOwogICAgICAKICAgICAgICAgICAgICBsZXQgZWxlbWVudCA9IG51bGw7CiAgICAgICAgICAgICAgd2hpbGUgKGVsZW1lbnQgPSBlbGVtZW50c0ZvdW5kLml0ZXJhdGVOZXh0KCkpIHsKICAgICAgICAgICAgICAgIGNvbnNvbGUubG9nKCJGb3VuZCAiLCBlbGVtZW50KTsKICAgICAgICAgICAgICB9CiAgICAgICAgICAgIH0KICAgICAgICAgICAgKi8KICAgICAgZGlzY29ubmVjdGVkQ2FsbGJhY2soKSB7CiAgICAgICAgY29uc29sZS5sb2coImRpc2Nvbm5lY3RlZCAiICsgdGhpcy50YWdOYW1lKTsKICAgICAgICBwcm9wcy5kaXNjb25uZWN0ZWRDYWxsYmFjaz8uKHRoaXMpOwogICAgICB9CiAgICAgIGFkb3B0ZWRDYWxsYmFjaygpIHsKICAgICAgICBjb25zb2xlLmxvZygiYWRvcHRlZCAiICsgdGhpcy50YWdOYW1lKTsKICAgICAgICBwcm9wcy5hZG9wdGVkQ2FsbGJhY2s/Lih0aGlzKTsKICAgICAgfQogICAgICBhdHRyaWJ1dGVDaGFuZ2VkQ2FsbGJhY2sobmFtZSwgb2xkVmFsdWUsIG5ld1ZhbHVlKSB7CiAgICAgICAgaWYgKCFwcm9wcy5hdHRyaWJ1dGVDaGFuZ2VkQ2FsbGJhY2spIHJldHVybjsKICAgICAgICBwcm9wcy5hdHRyaWJ1dGVDaGFuZ2VkQ2FsbGJhY2tbbmFtZV0oewogICAgICAgICAgZWxlbWVudDogdGhpcywKICAgICAgICAgIG5hbWUsCiAgICAgICAgICBvbGRWYWx1ZSwKICAgICAgICAgIG5ld1ZhbHVlCiAgICAgICAgfSk7CiAgICAgIH0KICAgIH0KICApOwp9OwoKLy8gc3JjL3V0aWxzL2FjY2Vzcy50cwpmdW5jdGlvbiBhY2Nlc3MocGF0aCwgb2JqKSB7CiAgbGV0IHJlc3VsdCA9IG9iajsKICBpZiAob2JqID09PSBudWxsKSByZXR1cm4gcmVzdWx0OwogIHBhdGguZm9yRWFjaCgoYXR0cmlidXRlKSA9PiB7CiAgICByZXN1bHQgPSByZXN1bHRbYXR0cmlidXRlXTsKICB9KTsKICByZXR1cm4gcmVzdWx0Owp9CgovLyBzcmMvdXRpbHMvZmxhdHRlbi50cwpmdW5jdGlvbiBmbGF0dGVuKG9iaiwgaWdub3JlID0gW10pIHsKICBjb25zdCBzdGFjayA9IFt7CiAgICBwYXRoOiBbXSwKICAgIG9iagogIH1dOwogIGNvbnN0IHJlc3VsdCA9IFtdOwogIHdoaWxlIChzdGFjay5sZW5ndGggPiAwKSB7CiAgICBjb25zdCB7IHBhdGgsIG9iajogb2JqMiB9ID0gc3RhY2sucG9wKCk7CiAgICBmb3IgKGNvbnN0IGtleSBpbiBvYmoyKSB7CiAgICAgIGlmIChpZ25vcmUuaW5jbHVkZXMoa2V5KSkgY29udGludWU7CiAgICAgIGNvbnN0IHZhbHVlID0gb2JqMltrZXldOwogICAgICBjb25zdCBuZXdQYXRoID0gcGF0aC5jb25jYXQoa2V5KTsKICAgICAgaWYgKHR5cGVvZiB2YWx1ZSA9PT0gIm9iamVjdCIgJiYgdmFsdWUgIT09IG51bGwpIHsKICAgICAgICBzdGFjay5wdXNoKHsKICAgICAgICAgIHBhdGg6IG5ld1BhdGgsCiAgICAgICAgICBvYmo6IHZhbHVlCiAgICAgICAgfSk7CiAgICAgIH0KICAgICAgcmVzdWx0LnB1c2goeyBwYXRoOiBuZXdQYXRoLCB2YWx1ZSB9KTsKICAgIH0KICB9CiAgcmV0dXJuIHJlc3VsdDsKfQoKLy8gc3JjL3V0aWxzL2lzUG9qby50cwpmdW5jdGlvbiBpc1BPSk8oYXJnKSB7CiAgaWYgKGFyZyA9PSBudWxsIHx8IHR5cGVvZiBhcmcgIT09ICJvYmplY3QiKSB7CiAgICByZXR1cm4gZmFsc2U7CiAgfQogIGNvbnN0IHByb3RvID0gT2JqZWN0LmdldFByb3RvdHlwZU9mKGFyZyk7CiAgaWYgKHByb3RvID09IG51bGwpIHsKICAgIHJldHVybiB0cnVlOwogIH0KICByZXR1cm4gcHJvdG8gPT09IE9iamVjdC5wcm90b3R5cGU7Cn0KCi8vIHNyYy9ib3JlLnRzCmZ1bmN0aW9uIGNyZWF0ZUV2ZW50c0hhbmRsZXIoYywgYXBwLCBkZXRhaWwpIHsKICByZXR1cm4gKGV2ZW50TmFtZSwgaGFuZGxlcikgPT4gewogICAgYWRkRXZlbnRMaXN0ZW5lcihldmVudE5hbWUsIChlKSA9PiB7CiAgICAgIGxldCB0YXJnZXQgPSBlPy5kZXRhaWw/LmV2ZW50LmN1cnJlbnRUYXJnZXQ7CiAgICAgIGxldCBlbWl0ZXJFbGVtID0gdm9pZCAwOwogICAgICB3aGlsZSAodGFyZ2V0KSB7CiAgICAgICAgaWYgKHRhcmdldCA9PT0gYykgewogICAgICAgICAgaGFuZGxlcih7IHN0YXRlOiBhcHAsIGU6IGUuZGV0YWlsLCBkZXRhaWwgfSk7CiAgICAgICAgICByZXR1cm47CiAgICAgICAgfQogICAgICAgIGlmICh0YXJnZXQgaW5zdGFuY2VvZiBIVE1MRWxlbWVudCkgewogICAgICAgICAgdGFyZ2V0ID0gdGFyZ2V0LnBhcmVudEVsZW1lbnQ7CiAgICAgICAgfSBlbHNlIHsKICAgICAgICAgIHRhcmdldCA9IHZvaWQgMDsKICAgICAgICB9CiAgICAgIH0KICAgIH0pOwogIH07Cn0KZnVuY3Rpb24gY3JlYXRlUmVmc0FjY2Vzc29yKGMpIHsKICByZXR1cm4gbmV3IFByb3h5KHt9LCB7CiAgICBnZXQodGFyZ2V0LCBwcm9wLCByZWNlaXZlcikgewogICAgICBjb25zdCBlcnJvciA9IG5ldyBFcnJvcigKICAgICAgICBgUmVmICIke1N0cmluZyhwcm9wKX0iIG5vdCBmb3VuZCBpbiA8JHtjLnRhZ05hbWV9PmAKICAgICAgKTsKICAgICAgaWYgKHR5cGVvZiBwcm9wID09PSAic3RyaW5nIikgewogICAgICAgIGNvbnN0IG5vZGVMaXN0ID0gYy5xdWVyeVNlbGVjdG9yQWxsKGBbZGF0YS1yZWY9IiR7cHJvcH0iXWApOwogICAgICAgIGlmICghbm9kZUxpc3QpIHRocm93IGVycm9yOwogICAgICAgIGNvbnN0IHJlZnMgPSBBcnJheS5mcm9tKG5vZGVMaXN0KS5maWx0ZXIoCiAgICAgICAgICAocmVmKSA9PiByZWYgaW5zdGFuY2VvZiBIVE1MRWxlbWVudAogICAgICAgICk7CiAgICAgICAgaWYgKHJlZnMubGVuZ3RoID09PSAwKSB0aHJvdyBlcnJvcjsKICAgICAgICBpZiAocmVmcy5sZW5ndGggPT09IDEpIHJldHVybiByZWZzWzBdOwogICAgICAgIHJldHVybiByZWZzOwogICAgICB9CiAgICB9CiAgfSk7Cn0KZnVuY3Rpb24gY3JlYXRlU2xvdHNBY2Nlc3NvcihjKSB7CiAgcmV0dXJuIG5ldyBQcm94eSh7fSwgewogICAgZ2V0KHRhcmdldCwgcHJvcCwgcmVjaWV2ZXIpIHsKICAgICAgY29uc3QgZXJyb3IgPSBuZXcgRXJyb3IoCiAgICAgICAgYFNsb3QgIiR7U3RyaW5nKHByb3ApfSIgbm90IGZvdW5kIGluIDwke2MudGFnTmFtZX0+YAogICAgICApOwogICAgICBpZiAodHlwZW9mIHByb3AgPT09ICJzdHJpbmciKSB7CiAgICAgICAgY29uc3Qgbm9kZUxpc3QgPSBjLnF1ZXJ5U2VsZWN0b3JBbGwoYHNsb3RbbmFtZT0iJHtwcm9wfSJdYCk7CiAgICAgICAgaWYgKCFub2RlTGlzdCkgdGhyb3cgZXJyb3I7CiAgICAgICAgY29uc3QgcmVmcyA9IEFycmF5LmZyb20obm9kZUxpc3QpLmZpbHRlcigKICAgICAgICAgIChyZWYpID0+IHJlZiBpbnN0YW5jZW9mIEhUTUxTbG90RWxlbWVudAogICAgICAgICk7CiAgICAgICAgaWYgKHJlZnMubGVuZ3RoID09PSAwKSB0aHJvdyBlcnJvcjsKICAgICAgICBpZiAocmVmcy5sZW5ndGggPT09IDEpIHJldHVybiByZWZzWzBdOwogICAgICAgIHJldHVybiByZWZzOwogICAgICB9CiAgICB9LAogICAgc2V0KHRhcmdldCwgcHJvcCwgdmFsdWUpIHsKICAgICAgaWYgKHR5cGVvZiBwcm9wICE9PSAic3RyaW5nIikgcmV0dXJuIGZhbHNlOwogICAgICBsZXQgZWxlbSA9IHZhbHVlOwogICAgICBpZiAodmFsdWUgaW5zdGFuY2VvZiBIVE1MRWxlbWVudCkgewogICAgICAgIHZhbHVlLnNldEF0dHJpYnV0ZSgiZGF0YS1zbG90IiwgcHJvcCk7CiAgICAgIH0gZWxzZSBpZiAodHlwZW9mIHZhbHVlID09PSAic3RyaW5nIikgewogICAgICAgIGVsZW0gPSBjcmVhdGUoInNwYW4iKTsKICAgICAgICBlbGVtLnNldEF0dHJpYnV0ZSgiZGF0YS1zbG90IiwgcHJvcCk7CiAgICAgICAgZWxlbS5pbm5lclRleHQgPSB2YWx1ZTsKICAgICAgfSBlbHNlIHsKICAgICAgICB0aHJvdyBuZXcgRXJyb3IoYEludmFsaWQgdmFsdWUgZm9yIHNsb3QgJHtwcm9wfSBpbiA8JHtjLnRhZ05hbWV9PmApOwogICAgICB9CiAgICAgIGNvbnN0IGV4aXN0aW5nU2xvdHMgPSBBcnJheS5mcm9tKAogICAgICAgIGMucXVlcnlTZWxlY3RvckFsbChgW2RhdGEtc2xvdD0iJHtwcm9wfSJdYCkKICAgICAgKTsKICAgICAgaWYgKGV4aXN0aW5nU2xvdHMubGVuZ3RoID4gMCkgewogICAgICAgIGV4aXN0aW5nU2xvdHMuZm9yRWFjaCgocykgPT4gcy5wYXJlbnRFbGVtZW50Py5yZXBsYWNlQ2hpbGQoZWxlbSwgcykpOwogICAgICB9IGVsc2UgewogICAgICAgIGNvbnN0IHNsb3RzID0gQXJyYXkuZnJvbShjLnF1ZXJ5U2VsZWN0b3JBbGwoYHNsb3RbbmFtZT0iJHtwcm9wfSJdYCkpOwogICAgICAgIHNsb3RzLmZvckVhY2goKHMpID0+IHMucGFyZW50RWxlbWVudD8ucmVwbGFjZUNoaWxkKGVsZW0sIHMpKTsKICAgICAgfQogICAgICByZXR1cm4gdHJ1ZTsKICAgIH0KICB9KTsKfQpmdW5jdGlvbiBjcmVhdGVTdGF0ZUFjY2Vzc29yKHN0YXRlLCBsb2csIGFjY3VtKSB7CiAgY29uc3QgY3VycmVudCA9IGFjY3VtIHx8IHsgdGFyZ2V0czogLyogQF9fUFVSRV9fICovIG5ldyBXZWFrTWFwKCksIHBhdGg6IFtdIH07CiAgaWYgKHN0YXRlID09PSB2b2lkIDApIHJldHVybiB2b2lkIDA7CiAgcmV0dXJuIG5ldyBQcm94eShzdGF0ZSwgewogICAgLy8gU3RhdGUgYWNjZXNzb3JzIGFyZSByZWFkLW9ubHk6CiAgICBzZXQodGFyZ2V0LCBwcm9wLCBuZXdWYWx1ZSkgewogICAgICBpZiAodHlwZW9mIHByb3AgPT09ICJzdHJpbmciKSB7CiAgICAgICAgY29uc29sZS5lcnJvcigKICAgICAgICAgIGBTdGF0ZSBpcyByZWFkLW9ubHkgZm9yIHdlYiBjb21wb25lbnRzLiBVbmFibGUgdG8gc2V0ICcke3Byb3B9Jy5gCiAgICAgICAgKTsKICAgICAgfQogICAgICByZXR1cm4gZmFsc2U7CiAgICB9LAogICAgLy8gUmVjdXJzaXZlbHkgYnVpbGQgYSBwcm94eSBmb3IgZWFjaCBzdGF0ZSBwcm9wIGJlaW5nIHJlYWQ6CiAgICBnZXQodGFyZ2V0LCBwcm9wLCByZWNlaXZlcikgewogICAgICBjb25zdCB2YWx1ZSA9IFJlZmxlY3QuZ2V0KHRhcmdldCwgcHJvcCwgcmVjZWl2ZXIpOwogICAgICBjb25zdCBpc1Byb3RvID0gcHJvcCA9PT0gIl9fcHJvdG9fXyI7CiAgICAgIGlmICh0eXBlb2YgcHJvcCA9PT0gInN0cmluZyIgJiYgIWlzUHJvdG8pIHsKICAgICAgICBpZiAoIWN1cnJlbnQudGFyZ2V0cy5oYXModGFyZ2V0KSkgewogICAgICAgICAgY3VycmVudC50YXJnZXRzLnNldCh0YXJnZXQsIGN1cnJlbnQucGF0aC5qb2luKCIuIikpOwogICAgICAgICAgY3VycmVudC5wYXRoLnB1c2gocHJvcCk7CiAgICAgICAgfQogICAgICB9CiAgICAgIGlmIChpc1Byb3RvIHx8IEFycmF5LmlzQXJyYXkodmFsdWUpIHx8IGlzUE9KTyh2YWx1ZSkpIHsKICAgICAgICByZXR1cm4gY3JlYXRlU3RhdGVBY2Nlc3Nvcih2YWx1ZSwgbG9nLCBjdXJyZW50KTsKICAgICAgfQogICAgICBsZXQgcGF0aCA9IGN1cnJlbnQudGFyZ2V0cy5nZXQodGFyZ2V0KSA/PyAiIjsKICAgICAgaWYgKHR5cGVvZiBwYXRoID09PSAic3RyaW5nIiAmJiB0eXBlb2YgcHJvcCA9PT0gInN0cmluZyIpIHsKICAgICAgICBpZiAoQXJyYXkuaXNBcnJheSh0YXJnZXQpKSB7CiAgICAgICAgICBwYXRoOwogICAgICAgIH0gZWxzZSB7CiAgICAgICAgICBwYXRoICs9IHBhdGggIT09ICIiID8gYC4ke3Byb3B9YCA6IHByb3A7CiAgICAgICAgfQogICAgICAgIGlmIChsb2cuaW5kZXhPZihwYXRoKSA9PT0gLTEpIHsKICAgICAgICAgIGxvZy5wdXNoKHBhdGgpOwogICAgICAgIH0KICAgICAgfQogICAgICBjdXJyZW50LnBhdGgubGVuZ3RoID0gMDsKICAgICAgY3VycmVudC5wYXRoLnB1c2gocGF0aCk7CiAgICAgIHJldHVybiB2YWx1ZTsKICAgIH0KICB9KTsKfQpmdW5jdGlvbiBjcmVhdGVTdWJzY3JpYmVyc0Rpc3BhdGNoZXIoc3RhdGUpIHsKICByZXR1cm4gKCkgPT4gewogICAgY29uc3QgdXBkYXRlcyA9IHN0YXRlLmludGVybmFsLnVwZGF0ZXM7CiAgICBmb3IgKGxldCBpID0gMDsgaSA8IHVwZGF0ZXMucGF0aC5sZW5ndGg7IGkrKykgewogICAgICBjb25zdCBwYXRoID0gdXBkYXRlcy5wYXRoW2ldOwogICAgICBjb25zdCBmdW5jdGlvbnMgPSB1cGRhdGVzLnN1YnNjcmliZXJzLmdldChwYXRoLnNsaWNlKHBhdGguaW5kZXhPZigiLiIpICsgMSkpID8/IFtdOwogICAgICBmb3IgKGxldCBqID0gMDsgaiA8IGZ1bmN0aW9ucy5sZW5ndGg7IGorKykgewogICAgICAgIGZ1bmN0aW9uc1tqXShzdGF0ZS5hcHApOwogICAgICB9CiAgICB9CiAgICB1cGRhdGVzLnBhdGggPSBbXTsKICAgIHVwZGF0ZXMudmFsdWUgPSBbXTsKICAgIHVwZGF0ZXMucmFmID0gdm9pZCAwOwogIH07Cn0KZnVuY3Rpb24gcHJveGlmeShib3JlZG9tKSB7CiAgY29uc3QgcnVudGltZSA9IGJvcmVkb20uaW50ZXJuYWw7CiAgY29uc3Qgc3RhdGUgPSBib3JlZG9tOwogIGlmIChzdGF0ZSA9PT0gdm9pZCAwKSByZXR1cm4gYm9yZWRvbTsKICBjb25zdCBvYmplY3RzV2l0aFByb3hpZXMgPSAvKiBAX19QVVJFX18gKi8gbmV3IFdlYWtTZXQoKTsKICBmbGF0dGVuKGJvcmVkb20sIFsiaW50ZXJuYWwiXSkuZm9yRWFjaCgoeyBwYXRoLCB2YWx1ZSB9KSA9PiB7CiAgICBjb25zdCBuZWVkc1Byb3h5ID0gQXJyYXkuaXNBcnJheSh2YWx1ZSkgfHwgaXNQT0pPKHZhbHVlKSAmJiAhb2JqZWN0c1dpdGhQcm94aWVzLmhhcyh2YWx1ZSk7CiAgICBpZiAobmVlZHNQcm94eSkgewogICAgICBjb25zdCBkb3R0ZWRQYXRoID0gcGF0aC5qb2luKCIuIik7CiAgICAgIGNvbnN0IHBhcmVudCA9IGFjY2VzcyhwYXRoLnNsaWNlKDAsIC0xKSwgc3RhdGUpOwogICAgICBjb25zdCBpc1Jvb3QgPSBwYXJlbnQgPT09IHZhbHVlOwogICAgICBpZiAoaXNSb290KSByZXR1cm47CiAgICAgIHBhcmVudFtwYXRoLmF0KC0xKV0gPSBuZXcgUHJveHkodmFsdWUsIHsKICAgICAgICBzZXQodGFyZ2V0LCBwcm9wLCBuZXdWYWx1ZSkgewogICAgICAgICAgY29uc3QgaXNDaGFuZ2VkID0gdGFyZ2V0W3Byb3BdICE9PSBuZXdWYWx1ZTsKICAgICAgICAgIGlmICghaXNDaGFuZ2VkKSByZXR1cm4gdHJ1ZTsKICAgICAgICAgIFJlZmxlY3Quc2V0KHRhcmdldCwgcHJvcCwgbmV3VmFsdWUpOwogICAgICAgICAgaWYgKHR5cGVvZiBwcm9wICE9PSAic3RyaW5nIikgcmV0dXJuIHRydWU7CiAgICAgICAgICBpZiAoQXJyYXkuaXNBcnJheSh2YWx1ZSkpIHsKICAgICAgICAgICAgcnVudGltZS51cGRhdGVzLnBhdGgucHVzaChgJHtkb3R0ZWRQYXRofWApOwogICAgICAgICAgfSBlbHNlIHsKICAgICAgICAgICAgcnVudGltZS51cGRhdGVzLnBhdGgucHVzaChgJHtkb3R0ZWRQYXRofS4ke3Byb3B9YCk7CiAgICAgICAgICB9CiAgICAgICAgICBydW50aW1lLnVwZGF0ZXMudmFsdWUucHVzaCh0YXJnZXQpOwogICAgICAgICAgaWYgKCFydW50aW1lLnVwZGF0ZXMucmFmKSB7CiAgICAgICAgICAgIHJ1bnRpbWUudXBkYXRlcy5yYWYgPSByZXF1ZXN0QW5pbWF0aW9uRnJhbWUoCiAgICAgICAgICAgICAgY3JlYXRlU3Vic2NyaWJlcnNEaXNwYXRjaGVyKGJvcmVkb20pCiAgICAgICAgICAgICk7CiAgICAgICAgICB9CiAgICAgICAgICByZXR1cm4gdHJ1ZTsKICAgICAgICB9CiAgICAgIH0pOwogICAgICBvYmplY3RzV2l0aFByb3hpZXMuYWRkKHZhbHVlKTsKICAgIH0KICB9KTsKICByZXR1cm4gYm9yZWRvbTsKfQpmdW5jdGlvbiBydW5Db21wb25lbnRzSW5pdGlhbGl6ZXIoc3RhdGUpIHsKICBjb25zdCB0YWdzSW5Eb20gPSBzdGF0ZS5pbnRlcm5hbC5jdXN0b21UYWdzLmZpbHRlcigKICAgICh0YWcpID0+IHF1ZXJ5Q29tcG9uZW50KHRhZykgIT09IHZvaWQgMAogICk7CiAgY29uc3QgY29tcG9uZW50cyA9IHN0YXRlLmludGVybmFsLmNvbXBvbmVudHM7CiAgZm9yIChjb25zdCBbdGFnTmFtZSwgY29kZV0gb2YgY29tcG9uZW50cy5lbnRyaWVzKCkpIHsKICAgIGlmIChjb2RlID09PSBudWxsIHx8ICF0YWdzSW5Eb20uaW5jbHVkZXModGFnTmFtZSkpIGNvbnRpbnVlOwogICAgY29uc3QgY29tcG9uZW50Q2xhc3MgPSBxdWVyeUNvbXBvbmVudCh0YWdOYW1lKTsKICAgIGlmICghY29tcG9uZW50Q2xhc3MpIHsKICAgICAgY29uc29sZS5sb2coCiAgICAgICAgYDwke3RhZ05hbWV9PiBpcyBub3QgeWV0IGluIHRoZSBET00uIFRoZSBhc3NvY2lhdGVkIEpTIHNjcmlwdCB3aWxsIGJlIGNhbGxlZCB3aGVuIHRoZSBjb21wb25lbnQgaXMgY29ubmVjdGVkLmAKICAgICAgKTsKICAgICAgcmV0dXJuOwogICAgfQogICAgY29kZShzdGF0ZSwgeyBpbmRleDogMCwgbmFtZTogdGFnTmFtZSwgZGF0YTogdm9pZCAwIH0pKAogICAgICBjb21wb25lbnRDbGFzcwogICAgKTsKICB9CiAgcmV0dXJuOwp9CmZ1bmN0aW9uIGNyZWF0ZUFuZFJ1bkNvZGUobmFtZSwgc3RhdGUsIGRldGFpbCkgewogIGNvbnN0IGNvZGUgPSBzdGF0ZS5pbnRlcm5hbC5jb21wb25lbnRzLmdldChuYW1lKTsKICBpZiAoY29kZSkgewogICAgY29uc3QgaW5mbyA9IHsgLi4uZGV0YWlsLCB0YWdOYW1lOiBuYW1lIH07CiAgICByZXR1cm4gY3JlYXRlQ29tcG9uZW50KG5hbWUsIGNvZGUoc3RhdGUsIGluZm8pKTsKICB9CiAgcmV0dXJuIGNyZWF0ZUNvbXBvbmVudChuYW1lKTsKfQoKLy8gc3JjL2luZGV4LnRzCmFzeW5jIGZ1bmN0aW9uIGluZmxpY3RCb3JlRE9NKHN0YXRlLCBjb21wb25lbnRzTG9naWMpIHsKICBjb25zdCByZWdpc3RlcmVkTmFtZXMgPSBzZWFyY2hGb3JDb21wb25lbnRzKCk7CiAgY29uc3QgY29tcG9uZW50c0NvZGUgPSBhd2FpdCBkeW5hbWljSW1wb3J0U2NyaXB0cyhyZWdpc3RlcmVkTmFtZXMpOwogIGlmIChjb21wb25lbnRzTG9naWMpIHsKICAgIGZvciAoY29uc3QgdGFnTmFtZSBvZiBPYmplY3Qua2V5cyhjb21wb25lbnRzTG9naWMpKSB7CiAgICAgIGNvbXBvbmVudHNDb2RlLnNldCh0YWdOYW1lLCBjb21wb25lbnRzTG9naWNbdGFnTmFtZV0pOwogICAgfQogIH0KICBjb25zdCBpbml0aWFsU3RhdGUgPSB7CiAgICBhcHA6IHN0YXRlLAogICAgaW50ZXJuYWw6IHsKICAgICAgY3VzdG9tVGFnczogcmVnaXN0ZXJlZE5hbWVzLAogICAgICBjb21wb25lbnRzOiBjb21wb25lbnRzQ29kZSwKICAgICAgdXBkYXRlczogewogICAgICAgIHBhdGg6IFtdLAogICAgICAgIHZhbHVlOiBbXSwKICAgICAgICByYWY6IHZvaWQgMCwKICAgICAgICBzdWJzY3JpYmVyczogLyogQF9fUFVSRV9fICovIG5ldyBNYXAoKQogICAgICB9CiAgICB9CiAgfTsKICBjb25zdCBwcm94aWZpZWRTdGF0ZSA9IHByb3hpZnkoaW5pdGlhbFN0YXRlKTsKICBydW5Db21wb25lbnRzSW5pdGlhbGl6ZXIocHJveGlmaWVkU3RhdGUpOwogIGlmICghcHJveGlmaWVkU3RhdGUuYXBwKSB0aHJvdyBuZXcgRXJyb3IoIlVuYWJsZSB0byBwcm94aWZ5IHN0YXRlIG9iamVjdC4iKTsKICByZXR1cm4gcHJveGlmaWVkU3RhdGUuYXBwOwp9CmZ1bmN0aW9uIHdlYkNvbXBvbmVudChpbml0RnVuY3Rpb24pIHsKICBsZXQgaXNJbml0aWFsaXplZCA9IG51bGw7CiAgbGV0IHJlbmRlckZ1bmN0aW9uOwogIHJldHVybiAoYXBwU3RhdGUsIGRldGFpbCkgPT4gKGMpID0+IHsKICAgIGNvbnN0IHsgaW50ZXJuYWwsIGFwcCB9ID0gYXBwU3RhdGU7CiAgICBsZXQgbG9nID0gW107CiAgICBjb25zdCBzdGF0ZSA9IGNyZWF0ZVN0YXRlQWNjZXNzb3IoYXBwLCBsb2cpOwogICAgY29uc3QgcmVmcyA9IGNyZWF0ZVJlZnNBY2Nlc3NvcihjKTsKICAgIGNvbnN0IHNsb3RzID0gY3JlYXRlU2xvdHNBY2Nlc3NvcihjKTsKICAgIGNvbnN0IG9uID0gY3JlYXRlRXZlbnRzSGFuZGxlcihjLCBhcHAsIGRldGFpbCk7CiAgICBpZiAoaXNJbml0aWFsaXplZCAhPT0gYykgewogICAgICBjb25zdCB1cGRhdGVTdWJzY3JpYmVycyA9IGFzeW5jICgpID0+IHsKICAgICAgICBjb25zdCBzdWJzY3JpYmVycyA9IGludGVybmFsLnVwZGF0ZXMuc3Vic2NyaWJlcnM7CiAgICAgICAgZm9yIChsZXQgcGF0aCBvZiBsb2cpIHsKICAgICAgICAgIGNvbnN0IGZ1bmN0aW9ucyA9IHN1YnNjcmliZXJzLmdldChwYXRoKTsKICAgICAgICAgIGlmIChmdW5jdGlvbnMpIHsKICAgICAgICAgICAgaWYgKCFmdW5jdGlvbnMuaW5jbHVkZXMocmVuZGVyRnVuY3Rpb24pKSB7CiAgICAgICAgICAgICAgZnVuY3Rpb25zLnB1c2gocmVuZGVyRnVuY3Rpb24pOwogICAgICAgICAgICB9CiAgICAgICAgICB9IGVsc2UgewogICAgICAgICAgICBzdWJzY3JpYmVycy5zZXQocGF0aCwgW3JlbmRlckZ1bmN0aW9uXSk7CiAgICAgICAgICB9CiAgICAgICAgfQogICAgICB9OwogICAgICBjb25zdCB1c2VyRGVmaW5lZFJlbmRlcmVyID0gaW5pdEZ1bmN0aW9uKHsKICAgICAgICBkZXRhaWwsCiAgICAgICAgc3RhdGUsCiAgICAgICAgcmVmcywKICAgICAgICBvbiwKICAgICAgICBzZWxmOiBjCiAgICAgIH0pOwogICAgICByZW5kZXJGdW5jdGlvbiA9IChzdGF0ZTIpID0+IHsKICAgICAgICB1c2VyRGVmaW5lZFJlbmRlcmVyKHsKICAgICAgICAgIHN0YXRlOiBzdGF0ZTIsCiAgICAgICAgICByZWZzLAogICAgICAgICAgc2xvdHMsCiAgICAgICAgICBzZWxmOiBjLAogICAgICAgICAgZGV0YWlsLAogICAgICAgICAgbWFrZUNvbXBvbmVudDogKHRhZywgb3B0cykgPT4gewogICAgICAgICAgICByZXR1cm4gY3JlYXRlQW5kUnVuQ29kZSh0YWcsIGFwcFN0YXRlLCBvcHRzPy5kZXRhaWwpOwogICAgICAgICAgfQogICAgICAgIH0pOwogICAgICAgIHVwZGF0ZVN1YnNjcmliZXJzKCk7CiAgICAgIH07CiAgICB9CiAgICByZW5kZXJGdW5jdGlvbihzdGF0ZSk7CiAgICBpc0luaXRpYWxpemVkID0gYzsKICB9Owp9CmV4cG9ydCB7CiAgaW5mbGljdEJvcmVET00sCiAgcXVlcnlDb21wb25lbnQsCiAgd2ViQ29tcG9uZW50Cn07Cg==
`;
var beautify = import_js_beautify.default.html;
var BUILD_DIR = "build";
var serverStarted = false;
var numberOfRefreshes = 0;
console.log("## boreDOM CLI options");
console.log(
  "## ",
  "--index <path to default html>",
  "The base HTML file to serve",
  "defaults to ./index.html"
);
console.log(
  "## ",
  "--html <folder>",
  "Folder containing HTML component files",
  'defaults to "./components"'
);
console.log(
  "## ",
  "--static <folder>",
  "Static files folder, all files in here are copied as is",
  'defaults to "./public"'
);
import_commander.program.option("--index <path to file>", "Index file to serve", "index.html").option(
  "--html <folder>",
  "Folder containing HTML component files",
  "components"
).option(
  "--static <folder>",
  "Folder containing static files to be copied as is",
  "public"
).parse(process.argv);
var options = import_commander.program.opts();
async function copyStatic() {
  const staticDir = import_path.default.resolve(options.static);
  if (await import_fs_extra.default.pathExists(staticDir)) {
    await import_fs_extra.default.copy(staticDir, import_path.default.join(BUILD_DIR, "static"));
    console.log("Static folder copied.");
  }
}
async function copyBoreDOM() {
  return import_fs_extra.default.writeFile(import_path.default.join(BUILD_DIR, "boreDOM.js"), atob(boredom));
}
async function processComponents() {
  let components = {};
  if (options.html) {
    const htmlFolder = import_path.default.resolve(options.html);
    const htmlFiles = glob.sync("**/*.html", { cwd: htmlFolder });
    for (const file of htmlFiles) {
      const filePath = import_path.default.join(htmlFolder, file);
      const content = await import_fs_extra.default.readFile(filePath, "utf-8");
      const $ = cheerio.load(content, { decodeEntities: false });
      const template = $("template[data-component]");
      if (template.length) {
        const componentName = template.attr("data-component");
        const fullTemplate = $.html(template);
        const componentBuildDir = import_path.default.join(
          BUILD_DIR,
          "components",
          componentName
        );
        await import_fs_extra.default.ensureDir(componentBuildDir);
        const destHtmlPath = import_path.default.join(
          componentBuildDir,
          `${componentName}.html`
        );
        await import_fs_extra.default.copy(filePath, destHtmlPath);
        console.log(`Copied ${componentName}.html to ${componentBuildDir}`);
        const componentDir = import_path.default.dirname(filePath);
        const jsMatch = glob.sync(`**/${componentName}.js`, {
          cwd: componentDir
        });
        const cssMatch = glob.sync(`**/${componentName}.css`, {
          cwd: componentDir
        });
        const hasJS = jsMatch.length > 0;
        if (jsMatch.length > 0) {
          const jsSrc = import_path.default.join(componentDir, jsMatch[0]);
          const destJsPath = import_path.default.join(
            componentBuildDir,
            `${componentName}.js`
          );
          await import_fs_extra.default.copy(jsSrc, destJsPath);
          console.log(`Copied ${componentName}.js to ${componentBuildDir}`);
        }
        const hasCSS = cssMatch.length > 0;
        if (cssMatch.length > 0) {
          const cssSrc = import_path.default.join(componentDir, cssMatch[0]);
          const destCssPath = import_path.default.join(
            componentBuildDir,
            `${componentName}.css`
          );
          await import_fs_extra.default.copy(cssSrc, destCssPath);
          console.log(`Copied ${componentName}.css to ${componentBuildDir}`);
        }
        components[componentName] = {
          templateTag: fullTemplate,
          hasJS,
          hasCSS
        };
      }
    }
  }
  return components;
}
async function updateIndex(components) {
  console.log(
    "Updated index.html with components:\n\n",
    JSON.stringify(components, null, 2)
  );
  const indexPath = import_path.default.resolve(options.index);
  let indexContent = await import_fs_extra.default.readFile(indexPath, "utf-8");
  const $ = cheerio.load(indexContent, { decodeEntities: false });
  $("head").prepend(
    `
  <script type="importmap">{ "imports": {      "@mr_hugo/boredom/dist/boreDOM.full.js": "./boreDOM.js",
       "boredom": "./boreDOM.js"
     } }</script>`
  );
  $("body").append(`
  <script src="boreDOM.js" type="module"></script>`);
  Object.keys(components).forEach((component) => {
    if (components[component].hasJS && $(`script[src="./components/${component}/${component}.js"]`).length === 0) {
      $("body").append(
        `
  <script src="./components/${component}/${component}.js" type="module"></script>`
      );
      console.log(`Added script reference for ${component}`);
    }
    if (components[component].hasCSS && $(`link[href="components/${component}/${component}.css"]`).length === 0) {
      $("head").append(
        `
  <link rel="stylesheet" href="components/${component}/${component}.css">`
      );
      console.log(`Added stylesheet reference for ${component}`);
    }
    if ($(`template[data-component="${component}"]`).length === 0) {
      $("body").append(`
  ${components[component].templateTag}`);
      console.log(`Injected template for ${component}`);
    }
  });
  $("template[data-component]").each((i, el) => {
    const comp = $(el).attr("data-component");
    if (!components[comp]) {
      $(el).remove();
      console.log(`Removed unused template for ${comp}`);
    }
  });
  const prettyHtml = beautify($.html(), {
    indent_size: 2,
    space_in_empty_paren: true
  });
  const buildIndex = import_path.default.join(BUILD_DIR, "index.html");
  await import_fs_extra.default.outputFile(buildIndex, prettyHtml);
  console.log("Index updated with pretty printed HTML.");
}
async function startServer() {
  if (serverStarted) return;
  function serveFile(req, res, opts) {
    let urlPath = decodeURIComponent(req.url.split(/[?#]/)[0]);
    if (urlPath === "/" || urlPath.endsWith("/")) {
      urlPath = import_path.default.posix.join(urlPath, "index.html");
    }
    const filePath = import_path.default.join(BUILD_DIR, urlPath);
    import_fs_extra.default.pathExists(filePath).then((exists) => {
      if (!exists) {
        res.writeHead(404, { "Content-Type": "text/plain" });
        return res.end("Not Found");
      }
      const contentType = import_mime_types.default.lookup(filePath) || "application/octet-stream";
      console.log("Content type is ", contentType, "for", filePath);
      res.writeHead(200, { "Content-Type": contentType });
      import_fs_extra.default.createReadStream(filePath).pipe(res);
    }).catch((err) => {
      console.error(err);
      res.writeHead(500, { "Content-Type": "text/plain" });
      res.end("Internal Server Error");
    });
  }
  const server = import_http.default.createServer((req, res) => {
    return serveFile(req, res, {
      cleanUrls: true,
      public: import_path.default.resolve(BUILD_DIR)
    });
  });
  let port = process.env.PORT || 8080;
  const serverHandler = () => {
    const { port: actualPort } = server.address();
    console.log(`Server running at http://localhost:${actualPort}`);
  };
  server.listen(port, serverHandler);
  server.on("error", (e) => {
    if (e.code === "EADDRINUSE") {
      console.log(
        "\x1B[33m%s\x1B[0m",
        `\u26A0\uFE0F Warning: Port ${port} in use, starting with a OS assigned port.`
      );
      setTimeout(() => {
        server.close();
        server.listen(0);
      }, 1e3);
    }
  });
  serverStarted = true;
}
async function build() {
  console.log("Starting build process...");
  await import_fs_extra.default.remove(BUILD_DIR);
  await import_fs_extra.default.ensureDir(BUILD_DIR);
  await copyStatic();
  await copyBoreDOM();
  const components = await processComponents();
  await updateIndex(components);
  console.log("Build process complete.");
}
async function watchFiles() {
  const pathsToWatch = [];
  if (options.index) {
    pathsToWatch.push(import_path.default.resolve(options.index));
  }
  if (options.html) {
    pathsToWatch.push(import_path.default.resolve(options.html));
  }
  const staticDir = import_path.default.join(process.cwd(), "static");
  if (await import_fs_extra.default.pathExists(staticDir)) {
    pathsToWatch.push(staticDir);
  }
  console.log("Watching for file changes in:", pathsToWatch);
  const watcher = import_chokidar.default.watch(pathsToWatch, { ignoreInitial: true });
  let rebuildTimeout;
  watcher.on("all", (event, filePath) => {
    console.log(`Detected ${event} on ${filePath}. Scheduling rebuild...`);
    if (rebuildTimeout) clearTimeout(rebuildTimeout);
    rebuildTimeout = setTimeout(() => {
      build().then(() => {
        console.log(
          `#${++numberOfRefreshes} - ${(/* @__PURE__ */ new Date()).toISOString()} - Build refreshed.`
        );
      }).catch((err) => console.error("Error during rebuild:", err));
    }, 100);
  });
}
async function main() {
  console.log("The file used as the base for HTML is:", options.index);
  const indexPath = import_path.default.join(process.cwd(), options.index);
  import_fs_extra.default.ensureFile(indexPath, (err) => {
    if (err) {
      console.log(
        "\x1B[31m%s\x1B[0m",
        `\u274C Error: The file "${indexPath}" was not found.
Please specify a location for it with "--index"`
      );
      process.exit(1);
    }
  });
  await build();
  startServer();
  await watchFiles();
}
main().catch((err) => {
  console.error(err);
  process.exit(1);
});
