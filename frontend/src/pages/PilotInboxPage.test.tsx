import {cleanup,render,screen} from '@testing-library/react';
import {afterEach,expect,it,vi} from 'vitest';
import {PilotInboxPage} from './PilotInboxPage';
import {pilotApplicationApi} from '@/services/pilotApplicationApi';
vi.mock('@/services/pilotApplicationApi',()=>({pilotApplicationApi:{list:vi.fn(),update:vi.fn()}}));
afterEach(()=>{cleanup();vi.resetAllMocks();});
it('does not present forbidden access as an empty inbox',async()=>{
 vi.mocked(pilotApplicationApi.list).mockRejectedValue({response:{status:403}});render(<PilotInboxPage/>);
 expect(await screen.findByRole('alert')).toHaveTextContent('restricted');expect(screen.queryByText('No applications on this page.')).not.toBeInTheDocument();
});
