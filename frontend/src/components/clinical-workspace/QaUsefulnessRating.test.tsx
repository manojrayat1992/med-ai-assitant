import {cleanup,render,screen} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {afterEach,expect,it,vi} from 'vitest';
import {QaUsefulnessRating} from './QaUsefulnessRating';
import {pilotResultsApi} from '@/services/pilotResultsApi';
vi.mock('@/services/pilotResultsApi',()=>({pilotResultsApi:{rate:vi.fn()}}));
afterEach(()=>{cleanup();vi.resetAllMocks();});
it('records only confirmed ratings and allows a changed opinion',async()=>{
 const user=userEvent.setup();render(<QaUsefulnessRating runId="run-one" issue={{id:'issue-one',type:'LATERALITY_CONFLICT',severity:'HIGH',message:'Side mismatch',recommendation:'Review side',evidence:[]}}/>);
 vi.mocked(pilotResultsApi.rate).mockRejectedValueOnce(new Error('offline'));
 await user.click(screen.getByRole('button',{name:/^Useful$/}));expect(await screen.findByRole('alert')).toHaveTextContent('not confirmed');expect(screen.queryByRole('status')).not.toBeInTheDocument();
 vi.mocked(pilotResultsApi.rate).mockResolvedValue();await user.click(screen.getByRole('button',{name:/^Useful$/}));expect(await screen.findByRole('status')).toHaveTextContent('Saved: useful');
 await user.click(screen.getByRole('button',{name:'Not useful'}));expect(pilotResultsApi.rate).toHaveBeenLastCalledWith('run-one','issue-one',false);expect(screen.getByRole('status')).toHaveTextContent('Saved: not useful');
});
