/*
 * @Author: mengzonefire
 * @Date: 2021-10-14 16:36:56
 * @LastEditTime: 2023-01-14 21:29:51
 * @LastEditors: mengzonefire
 * @Description: 共用JS工具库
 */

const version = "1.4";
const updateUrl =
  "https://api.github.com/repos/mengzonefire/baidupan-rapidupload/releases/latest";
const releasePage =
  "https://github.com/mengzonefire/baidupan-rapidupload/releases/tag/";
const bdlinkPattern = /#bdlink=([\da-zA-Z+/=]+)/u; // b64可能出现的字符: 大小写字母a-zA-Z, 数字0-9, +, /, = (=用于末尾补位)
const illegalPathPattern = /[\\":*?<>|]/gu; // 匹配路径中的非法字符

function checkBdstoken(bdstoken) {
  if (!bdstoken || /^[\da-z]{32}$/u.test(bdstoken)) {
    localStorage.setItem("Blink_bdstoken", bdstoken);
    return true;
  }
  alert("bdstoken错误, 正确格式为32位字母数字组合");
  return false;
}

function checkPath(path) {
  if (!path.match(/["\\:*?<>|]/u)) {
    localStorage.setItem("Blink_savePath", path);
    return true;
  }
  alert('转存路径错误, 不能含有字符\\":*?<>|, 示例: /GTA5/');
  return false;
}

function checkUpdate() {
  const d = new Date();
  const date = d.getMonth().toString() + d.getDate().toString();
  if (date === localStorage.getItem("Last_checkUpdate")) {
    const lastVersion = localStorage.getItem("Last_version");
    if (lastVersion && version !== lastVersion) {
      $("#version").after(
        `<p>发现新版本 <a href="${releasePage}${lastVersion}" target=_blank>v${lastVersion}</a>, 请联系网站管理员更新</p>`
      );
    }
    return;
  }
  localStorage.setItem("Last_checkUpdate", date);
  $.ajax({
    url: updateUrl,
    type: "GET",
    dataType: "json",
    success(data, statusTxt) {
      localStorage.setItem("Last_version", data.tag_name.toString());
      if (statusTxt === "success" && data.tag_name !== version) {
        $("#version").after(
          `<p>发现新版本 <a href="${releasePage}${data.tag_name}" target=_blank>v${data.tag_name}</a>, 请联系网站管理员更新</p>`
        );
      }
    },
  });
}

function openPostWindow(url, data) {
  // create form
  const tempForm = document.createElement("form");
  document.body.appendChild(tempForm);
  tempForm.method = "post";
  tempForm.target = "_blank";
  tempForm.action = url;

  // add data
  const key = Object.getOwnPropertyNames(data);
  for (let i = 0; i < key.length; i++) {
    const hideInput = document.createElement("input");
    hideInput.type = "hidden";
    hideInput.name = key[i];
    hideInput.value = data[key[i]];
    tempForm.appendChild(hideInput);
  }

  // submit
  tempForm.submit();
  document.body.removeChild(tempForm);
}

function saveFile(md5, md5s, size, path, bdstoken) {
  openPostWindow(
    `https://pan.baidu.com/api/rapidupload${
      bdstoken ? "?bdstoken=" + bdstoken : ""
    }`,
    {
      "content-length": size,
      "content-md5": md5.toLowerCase(),
      "slice-md5": md5s.toLowerCase(),
      path,
    }
  );
}

function saveFile2(md5, size, path, bdstoken) {
  openPostWindow(
    `https://pan.baidu.com/rest/2.0/xpan/file?method=create${
      bdstoken ? "&bdstoken=" + bdstoken : ""
    }`,
    {
      size,
      path,
      block_list: JSON.stringify([md5.toLowerCase()]),
      rtype: 0,
    }
  );
}

/**
 * @description: 解密已加密的md5
 */
function decryptMd5(md5) {
  if (
    !(
      (parseInt(md5[9]) >= 0 && parseInt(md5[9]) <= 9) ||
      (md5[9] >= "a" && md5[9] <= "f")
    )
  )
    return decrypt(md5);
  else return md5;

  function decrypt(encryptMd5) {
    let key = (encryptMd5[9].charCodeAt(0) - "g".charCodeAt(0)).toString(16);
    let key2 = encryptMd5.slice(0, 9) + key + encryptMd5.slice(10);
    let key3 = "";
    for (let a = 0; a < key2.length; a++)
      key3 += (parseInt(key2[a], 16) ^ (15 & a)).toString(16);
    let md5 =
      key3.slice(8, 16) +
      key3.slice(0, 8) +
      key3.slice(24, 32) +
      key3.slice(16, 24);
    return md5;
  }
}

/**
 * @description: 从url中解析秒传链接
 */
function parseQueryLink(url) {
  const bdlinkB64 = url.match(bdlinkPattern);
  return bdlinkB64 ? bdlinkB64[1].fromBase64() : "";
}

/**
 * @description: 秒传链接解析器
 */
class DuParser {
  constructor() {}
  static parse(szUrl) {
    let r;
    if (szUrl.indexOf("bdpan") === 0) {
      r = DuParser.parseDu_v1(szUrl);
      r.ver = "PanDL";
    } else if (szUrl.indexOf("BaiduPCS-Go") === 0) {
      r = DuParser.parseDu_v2(szUrl);
      r.ver = "PCS-Go";
    } else if (szUrl.indexOf("BDLINK") === 0) {
      r = DuParser.parseDu_v3(szUrl);
      r.ver = "游侠 v1";
    } else {
      r = DuParser.parseDu_v4(szUrl);
      r.ver = "梦姬标准";
    }
    return r;
  }
  static parseDu_v1(szUrl) {
    return szUrl
      .replace(/\s*bdpan:\/\//gu, " ")
      .trim()
      .split(" ")
      .map((z) =>
        z
          .trim()
          .fromBase64()
          .match(/([\s\S]+)\|([\d]{1,20})\|([\dA-Fa-f]{32})\|([\dA-Fa-f]{32})/u)
      )
      .filter((z) => z)
      .map((info) => ({
        md5: info[3],
        md5s: info[4],
        size: info[2],
        path: info[1],
      }));
  }
  static parseDu_v2(szUrl) {
    return szUrl
      .split("\n")
      .map((z) =>
        z
          .trim()
          .match(
            /-length=([\d]{1,20}) -md5=([\dA-Fa-f]{32}) -slicemd5=([\dA-Fa-f]{32})[\s\S]+"([\s\S]+)"/u
          )
      )
      .filter((z) => z)
      .map((info) => ({
        md5: info[2],
        md5s: info[3],
        size: info[1],
        path: info[4],
      }));
  }
  static parseDu_v3(szUrl) {
    const raw = atob(szUrl.slice(6).replace(/\s/gu, ""));
    if (raw.slice(0, 5) !== "BDFS\x00") return null;

    const buf = new SimpleBuffer(raw);
    let ptr = 9;
    const arrFiles = [];
    let fileInfo, nameSize;
    const total = buf.readUInt(5);
    let i;
    for (i = 0; i < total; i++) {
      /*
       * 大小 (8 bytes)
       * MD5 + MD5S (0x20)
       * nameSize (4 bytes)
       * Name (unicode)
       */
      fileInfo = {};
      fileInfo.size = buf.readULong(ptr + 0);
      fileInfo.md5 = buf.readHex(ptr + 8, 0x10);
      fileInfo.md5s = buf.readHex(ptr + 0x18, 0x10);
      nameSize = buf.readUInt(ptr + 0x28) << 1;
      fileInfo.nameSize = nameSize;
      ptr += 0x2c;
      fileInfo.path = buf.readUnicode(ptr, nameSize);
      arrFiles.push(fileInfo);
      ptr += nameSize;
    }
    return arrFiles;
  }
  static parseDu_v4(szUrl) {
    return szUrl
      .split("\n")
      .map(function (z) {
        return z
          .trim()
          .match(
            /^([\da-f]{9}[\da-z][\da-f]{22})#(?:([\da-f]{32})#)?([\d]{1,20})#([\s\S]+)/iu
          ); // 22.8.29新增支持第10位为g-z的加密md5, 输入后自动解密转存
      })
      .filter(function (z) {
        return z;
      })
      .map(function (info) {
        return {
          // 标准码 / 短版标准码(无md5s)
          md5: decryptMd5(info[1].toLowerCase()),
          md5s: info[2] || "",
          size: info[3],
          path: info[4],
        };
      });
  }
}

/**
 * 一个简单的类似于 NodeJS Buffer 的实现.
 * 用于解析游侠度娘提取码。
 * @param {SimpleBuffer}
 */
class SimpleBuffer {
  constructor(str) {
    this.fromString(str);
  }
  static toStdHex(n) {
    return `0${n.toString(16)}`.slice(-2);
  }
  fromString(str) {
    const len = str.length;
    this.buf = new Uint8Array(len);
    for (let i = 0; i < len; i++) {
      this.buf[i] = str.charCodeAt(i);
    }
  }
  readUnicode(index, size) {
    if (size & 1) size++;

    const bufText = Array.prototype.slice
      .call(this.buf, index, index + size)
      .map(SimpleBuffer.toStdHex);
    const buf = [""];
    for (let i = 0; i < size; i += 2) {
      buf.push(bufText[i + 1] + bufText[i]);
    }
    return JSON.parse(`"${buf.join("\\u")}"`);
  }
  readNumber(index, size) {
    let ret = 0;
    for (let i = index + size; i > index; ) {
      ret = this.buf[--i] + ret * 256;
    }
    return ret;
  }
  readUInt(index) {
    return this.readNumber(index, 4);
  }
  readULong(index) {
    return this.readNumber(index, 8);
  }
  readHex(index, size) {
    return Array.prototype.slice
      .call(this.buf, index, index + size)
      .map(SimpleBuffer.toStdHex)
      .join("");
  }
}
