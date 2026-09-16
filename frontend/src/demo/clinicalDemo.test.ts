import { describe, expect, it } from 'vitest';
import { checkDemoReport, demoCases } from './clinicalDemo';
describe('synthetic case checks', () => {
  for (const c of demoCases) {
    it(`${c.id}: detects intentional discrepancies and accepts example`, () => {
      expect(checkDemoReport(c.id, c.initial)).toHaveLength(2);
      expect(checkDemoReport(c.id, c.example)).toEqual([]);
    });
    it(`${c.id}: removing sections does not clear review`, () => {
      expect(checkDemoReport(c.id, {findings:'', comparison:'', impression:''})).toHaveLength(3);
    });
  }
  it('rejects negated or conflicting right-sided effusion wording', () => {
    for (const text of ['No right pleural effusion.', 'Right pleural effusion is absent.', 'Right pleural effusion. Left pleural effusion.']) {
      expect(checkDemoReport('radiology', {...demoCases[0].example, impression:text})).toHaveLength(1);
    }
  });
  it('checks laboratory unit as well as value', () => {
    expect(checkDemoReport('laboratory', {...demoCases[1].example, findings:'Hemoglobin: 10.2 mg/dL.'})[0].id).toBe('hemoglobin-value');
  });
});
