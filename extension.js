const vscode = require("vscode");
const fs = require("fs");
const path = require("path");

function checkIfLineIsInLanguageRegex(languageDict, document, position) {
	const line = document.lineAt(position);
	const text = line.text;
	for (const patternName in languageDict) {
		let regexCheck = text.match(languageDict[patternName].regexParsed);
		if (regexCheck) {
			return true;
		}
	}
	return false;
}

function checkForInLanguageRegexJson(languageDict, document, position) {
  const line = document.lineAt(position);
  const text = line.text;
	const firstSemiColon = text.indexOf(";") - 1;
	if (firstSemiColon !== -1 && firstSemiColon < position.e) {
		return null;
	}
	if(text[position.e] == ' ')
	  return null;
  for (const patternName in languageDict) {
    let regexCheck = text.match(languageDict[patternName].regexParsed);
    if (regexCheck) {
      let matchObj = languageDict[patternName];
      let header = "";
      if (matchObj.descriptive_name) {
        if (matchObj.Mnemonic) {
          header = `${matchObj.Mnemonic}(${matchObj.descriptive_name}): `;
        } else {
          header = `${matchObj.descriptive_name}: `;
        }
      }

      let description = matchObj.description ? matchObj.description + "\n" : "";
      let binaryFormat = matchObj.binary_format
        ? `Binary format: ${matchObj.binary_format}\n`
        : "";
      let flags = `Flags set: ${
        matchObj.flags_set ? matchObj.flags_set : "None"
      }`;
      let explaination = matchObj.explaination
        ? `\n${matchObj.explaination}\n`
        : "";
			let whatIsCalculated = matchObj.binary_format.indexOf("offset") > -1 ? "Offset" : "Value";
			
      let calculatedOffset = "";
			if(regexCheck && regexCheck[1]){
				let decimalNumber = binaryStringToDecimal(regexCheck[1]);
				let lineText = "";
				if(whatIsCalculated === "Offset"){
					let validLines = 0;
					let i = 0;
					for(i = position.line; i < document.lineCount; i++){
						if(checkIfLineIsInLanguageRegex(languageDict, document, new vscode.Position(i, 0))){
							validLines++;
							if(validLines == decimalNumber){
								break;
							}
						}
					}
					let vscodeLineNumber = position.line + i;
					let line = document.lineAt(vscodeLineNumber - 1);
					lineText = `Offset pointing to vscode line ${vscodeLineNumber}: \n${line.text.trim()}\n`;
				}
				// if the decimal number is a printable character, convert it to a char
				let decimalToChar = decimalNumber >= 32 && decimalNumber <= 126 ? String.fromCharCode(decimalNumber) : null;
				let decimalToCharStr = decimalToChar ? ` = '${decimalToChar}' =` : "";
				calculatedOffset = `${whatIsCalculated}: ${regexCheck[1].trim()} = ${decimalNumber}${decimalToCharStr} 0x${decimalNumber.toString(16)}\n${lineText}`;
			}
      return `${header}${description}${binaryFormat}${calculatedOffset}${flags}${explaination}`;
    }
  }
  return null;
}


function binaryStringToDecimal(binaryString) {
  let binaryNumber = binaryString.replace(/\s/g, "");
  let isNegative = binaryNumber[0] === '1';
  let decimalNumber;

  if (isNegative) {
    // Flip the bits
    binaryNumber = binaryNumber.split('').map(bit => bit === '1' ? '0' : '1').join('');
    // Add 1
    decimalNumber = parseInt(binaryNumber, 2) + 1;
    // Make the number negative
    decimalNumber = -decimalNumber;
  } else {
    decimalNumber = parseInt(binaryNumber, 2);
  }

  return decimalNumber;
}

function loadRegexJson(languageDict, context, jsonFilePathStr) {
  const jsonFilePath = path.join(context.extensionPath, jsonFilePathStr);

  // Load the JSON file
  const fullRegexData = JSON.parse(fs.readFileSync(jsonFilePath, "utf8"));
  const binaryRegex = fullRegexData["repository"]["binary"]["patterns"];

  for (const pattern of binaryRegex) {
    // iterate over array
    languageDict[pattern.name] = pattern;
    languageDict[pattern.name].regexParsed = new RegExp(
      languageDict[pattern.name].match
    ); // cache the regex
  }
}

function activate(context) {
  const languageDict = {};
  loadRegexJson(languageDict, context, "syntaxes\\lcc.tmLanguage.json");

  context.subscriptions.push(
    vscode.languages.registerHoverProvider("lcc", {
      provideHover(document, position, token) {
        const info = checkForInLanguageRegexJson(
          languageDict,
          document,
          position
        );
        if (info) {
          return new vscode.Hover(
            new vscode.MarkdownString("```lcc\n" + info + "\n```")
          );
        }
      },
    })
  );
}

// This method is called when your extension is deactivated
function deactivate() {}

module.exports = {
  activate,
  deactivate,
};
