import {cleanup,render,screen,within} from '@testing-library/react';
import {MemoryRouter} from 'react-router-dom';
import {afterEach,beforeEach,expect,it,vi} from 'vitest';
import {PilotResultsPage} from './PilotResultsPage';
import {pilotResultsApi,type PilotResults} from '@/services/pilotResultsApi';
import {useAuthStore} from '@/stores/authStore';
vi.mock('@/services/pilotResultsApi',()=>({pilotResultsApi:{get:vi.fn()}}));
const empty:PilotResults={from:'2026-09-01',to:'2026-09-16',generatedAt:'2026-09-16T10:00:00Z',trackingSince:'2026-09-16T00:00:00Z',qa:{runs:0,reports:0,alerts:0,ratings:0,useful:0,rated_alerts:0},editing:{saves:0,reports:0},reporting:{signed:0,edited:0,timed:0,median_minutes:null,p90_minutes:null},adoption:{eligible:0,active:0},daily:[]};
beforeEach(()=>{vi.resetAllMocks();useAuthStore.setState({role:'DOCTOR'});});afterEach(()=>{cleanup();useAuthStore.getState().clear();});
it('shows unavailable denominators and time as not measured instead of perfect results',async()=>{
 vi.mocked(pilotResultsApi.get).mockResolvedValue(empty);render(<MemoryRouter><PilotResultsPage/></MemoryRouter>);
 const heading=await screen.findByRole('heading',{name:'Useful QA ratings'});expect(within(heading.closest('section')!).getAllByText(/Not measured/).length).toBeGreaterThan(0);
 expect(screen.queryByText('100.0%')).not.toBeInTheDocument();expect(screen.getByText('No signed reports in this window.')).toBeInTheDocument();
});
it('shows useful-rating and adoption denominators from server measurements',async()=>{
 vi.mocked(pilotResultsApi.get).mockResolvedValue({...empty,qa:{runs:4,reports:2,alerts:8,ratings:4,useful:3,rated_alerts:4},adoption:{eligible:5,active:2}});
 render(<MemoryRouter><PilotResultsPage/></MemoryRouter>);
 expect(await screen.findByText('75.0%')).toBeInTheDocument();expect(screen.getByText('40.0%')).toBeInTheDocument();expect(screen.getByText('3 useful / 4 clinician ratings')).toBeInTheDocument();
});
it('reports errors without displaying invented metrics',async()=>{
 vi.mocked(pilotResultsApi.get).mockRejectedValue(new Error('offline'));render(<MemoryRouter><PilotResultsPage/></MemoryRouter>);
 expect(await screen.findByRole('alert')).toHaveTextContent('Could not load');expect(screen.queryByRole('heading',{name:'Useful QA ratings'})).not.toBeInTheDocument();
});
