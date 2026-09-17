import { expect, it } from 'vitest';
import { resolveClinicalTarget } from '../../../vendor/human-atlas/app/clinical-bridge';
const atlas={concepts:[{id:'left',name:'left lung',elements:['l']},{id:'right',name:'right lung',elements:['r']},{id:'heart',name:'heart',elements:['h']}]};
it('preserves laterality and combines bilateral targets',()=>{
 expect(resolveClinicalTarget(atlas,{structure:'LUNG',side:'RIGHT'})?.elements).toEqual(['r']);
 expect(resolveClinicalTarget(atlas,{structure:'LUNG',side:'LEFT'})?.elements).toEqual(['l']);
 expect(resolveClinicalTarget(atlas,{structure:'LUNG',side:'BILATERAL'})?.elements).toEqual(['l','r']);
});
it('does not invent a side or guess an unsupported structure',()=>{
 expect(resolveClinicalTarget(atlas,{structure:'LUNG',side:'UNSPECIFIED'})).toBeNull();
 expect(resolveClinicalTarget(atlas,{structure:'KNEE',side:'RIGHT'})).toBeNull();
 expect(resolveClinicalTarget(atlas,{structure:'HEART',side:'UNSPECIFIED'})?.id).toBe('heart');
});
