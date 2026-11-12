/** Passenger-only AHP (Saaty eigenvector) + Mamdani credibility inference.
 * Prototype preferences; no claim of accident risk or personal safety. */
export const CRITERIA=['Caminata','Llegada final','Aporte','Valoraciones'] as const;
export type Matrix=number[][];
export const PROFILES={balanced:[4,3,2,1],economy:[2,3,5,1],fast:[2,5,2,1]} as const;
export function ratioMatrix(values:readonly number[]):Matrix{return values.map(a=>values.map(b=>a/b));}
export function analyze(matrix:Matrix){
 const n=matrix.length;
 if(n!==4||matrix.some((row,i)=>row.length!==n||row.some((v,j)=>!Number.isFinite(v)||v<1/9-1e-9||v>9+1e-9||Math.abs(v*matrix[j]?.[i]-1)>1e-6)) )throw new Error('La matriz debe ser positiva, recíproca y usar la escala 1/9 a 9.');
 let weights=Array(n).fill(1/n) as number[];
 for(let k=0;k<100;k++){const next=matrix.map(row=>row.reduce((sum,v,j)=>sum+v*weights[j],0));const sum=next.reduce((a,b)=>a+b,0);weights=next.map(v=>v/sum);}
 const lambda=matrix.reduce((sum,row,i)=>sum+row.reduce((s,v,j)=>s+v*weights[j],0)/weights[i],0)/n;
 const cr=Math.max(0,(lambda-n)/(n-1)/0.90);
 return {weights,cr,consistent:cr<0.10};
}
function triangle(x:number,a:number,b:number,c:number){if(x<a||x>c)return 0;if(x===b)return 1;return x<b?(x-a)/(b-a):(c-x)/(c-b);}
/** Centroid of min-clipped consequents, max aggregation, 101 samples. */
export function fuzzyRatings(rating:number|null,count:number):number{
 if(!Number.isFinite(count)||count<=0||rating===null||!Number.isFinite(rating))return 50;
 const x=Math.max(0,Math.min(5,rating)),n=Math.max(0,Math.min(50,count));
 const low=triangle(x,0,0,3),mid=triangle(x,2,3.5,4.6),high=triangle(x,3.8,5,5);
 const few=triangle(n,0,0,10),some=triangle(n,2,12,30),many=triangle(n,15,50,50);
 const firing=[low,Math.max(mid,Math.min(high,few)),Math.min(high,Math.max(some,many))];
 let area=0,moment=0;
 for(let y=0;y<=100;y++){const mu=Math.max(Math.min(firing[0],triangle(y,0,0,45)),Math.min(firing[1],triangle(y,25,50,75)),Math.min(firing[2],triangle(y,55,100,100)));area+=mu;moment+=mu*y;}
 return area?moment/area:50;
}
export interface PassengerMetrics{id:string;walkingSeconds:number;arrivalSeconds:number;price:number;rating:number|null;ratingCount:number}
export function rankPassengerOptions(options:PassengerMetrics[],matrix:Matrix){
 const ahp=analyze(matrix);
 if(!ahp.consistent)return {ahp,ranking:[]};
 const valid=options.filter(o=>[o.walkingSeconds,o.arrivalSeconds,o.price].every(v=>Number.isFinite(v)&&v>=0));
 const rows=valid.map(o=>({option:o,raw:[o.walkingSeconds,o.arrivalSeconds,o.price,fuzzyRatings(o.rating,o.ratingCount)]}));
 const ranking=rows.map(row=>{
  const normalized=row.raw.map((v,i)=>{const values=rows.map(r=>r.raw[i]),lo=Math.min(...values),hi=Math.max(...values);if(hi===lo)return 1;return i===3?(v-lo)/(hi-lo):1-(v-lo)/(hi-lo);});
  const contributions=normalized.map((v,i)=>v*ahp.weights[i]);
  const top=contributions.indexOf(Math.max(...contributions));
  return {id:row.option.id,score:contributions.reduce((a,b)=>a+b,0),fuzzy:row.raw[3],explanation:`Mayor aporte al puntaje: ${CRITERIA[top].toLowerCase()} (${Math.round(ahp.weights[top]*100)}% de peso).`,contributions};
 }).sort((a,b)=>b.score-a.score||a.id.localeCompare(b.id));
 return {ahp,ranking};
}
