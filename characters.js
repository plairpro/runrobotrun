// A future quiz can return one of these stable IDs. Only the selected asset is loaded.
const clips={idle:'Idle',run:'Run',jump:'Jump',death:'Death',win:'Yes'};
const palette={Main:'#fffaff',Accent:'#ad83ef',Grey:'#706b88',LightGrey:'#ded7ee',Black:'#291f38',Eye:'#62f4eb'};
export const CHARACTERS=Object.freeze(Object.fromEntries(['Stan','Leela','Mike','George'].map(name=>{
 const id=name.toLowerCase();return [id,{id,name,url:`./assets/mechs/${id}.glb`,height:1.65,runSpeed:170/120*1.0416667,clips:{...clips},palette:{...palette}}];
})));
export const DEFAULT_CHARACTER_ID='stan';
export function getCharacter(id=DEFAULT_CHARACTER_ID){const definition=CHARACTERS[id];if(!definition)throw new Error(`Unknown character: ${id}`);return definition;}
