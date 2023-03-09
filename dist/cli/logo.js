"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.HELP_HEADER = void 0;
const chalk_1 = __importDefault(require("chalk"));
const CLI_TITLE = chalk_1.default.bold.underline('@open-wa/wa-automate EASY API CLI');
const CLI_DESCRIPTION = 'The easiest way to get started with WA automation';
const CLI_USAGE = 'Usage: \`npx open-wa/wa-automate -p 8080 --disable-spins -a [options ...]\`';
const TWITTER = 'Follow for updates on twitter @openwadev';
const g = chalk_1.default.gray;
const m = chalk_1.default.magenta;
const o = chalk_1.default.yellow;
const d = chalk_1.default.hex('#302c3b');
const l = chalk_1.default.hex('#0092a5');
const sk = chalk_1.default.hex('#aababf');
exports.HELP_HEADER = `                                                                                
                                                                                
                                                                                
                                                                                
                                      ${o(`&&/&`)}                                      
        ${g(`%%%%%`)}                      ${o(`//////////%`)}                      ${g(`%%%%%`)}        
        ${g(`%%%%%`)}                   ${m(`&&(///////////%&`)}                    ${g(`%%%%`)}        
	   ${sk(`,,,,`)}                  ${m(`&&&&&&&&&&&&&&&&&&&`)}                  ${sk(`,,,`)}         
          ${sk(`,,,`)}  ${l(`#(((((((((((((((((((((((((((((((((((((((((((((((((`)}   ${sk(`,,,`)}         
          ${sk(`,,,`)} ${l(`(((`)},.............................................${l(`(((#`)}${sk(`,,,,`)}         
          ${sk(`,,,,`)}${l(`(((`)}..............................................,${l(`(((`)}${sk(`,,,&`)}         
          ${sk(`&,,,`)}${l(`(((`)}..............................................,${l(`(((`)}${sk(`,,,`)}          
           ${sk(`,,,`)}${l(`(((`)}.......           ...........           ......,${l(`(((`)}${sk(`,,,`)}          ${CLI_TITLE}
           ${sk(`,,,`)}${l(`(((`)}.....               .......               ....,${l(`(((`)}${sk(`,,%`)}          
	   ${d(`%%%%%`)}${l(`(((`)}...       ${d(`&&&&&(`)}     .....     ${d(`&&&&&&`)}      ...,${l(`((`)}${d(`#%%%%%`)}        
        ${d(`%%%%%%`)}${l(`(((`)}...      ${d(`&&&&&&&`)}     ....     ${d(`#&&&&&&*`)}      ..,${l(`((`)}${d(`#%%%%%`)}        ${CLI_DESCRIPTION}
        ${d(`%%%%%%`)}${l(`(((`)}...       ${d(`&&&&&.`)}     .....     ${d(`&&&&&%`)}      ...,${l(`((`)}${d(`#%%%%%%`)}       
        ${d(`%%%%%%`)}${l(`(((`)}.....               .......               ....,${l(`((`)}${d(`#%%%%%%`)}       
        ${d(`%%%%%%`)}${l(`(((`)}....             .....  .....          .......,${l(`((`)}${d(`#%%%%%%`)}       ${CLI_USAGE}
        ${d(`%%%%%%`)}${l(`(((`)}......................   .....................,${l(`((`)}${d(`#%%%%%`)}        
         ${d(`%%%%%`)}${l(`(((`)}..............................................,${l(`((`)}${d(`#%%%%&`)}        ${TWITTER}
              ${l(`(((`)}...........&&&&&&&&&&&&&&&&&&&&&&&&*..........,${l(`(((`)}             
              ${l(`(((`)}...........&&     %&      %&.    (&/..........,${l(`(((`)}             
              ${l(`(((`)}...........&&.....%&......%&,....(&/..........,${l(`(((`)}             
              ${l(`(((`)}..............................................,${l(`(((`)}             
              ${l(`(((`)}*.............................................${l(`(((#`)}             
               ${l(`#(((((((((((((((((((((((((((((((((((((((((((((((((`)}               
                                                                                
                                                                                
                                                                                
                                                                                
                                                                                 `;