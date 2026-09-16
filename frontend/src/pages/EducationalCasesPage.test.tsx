import {cleanup,render,screen} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {MemoryRouter,Routes,Route} from 'react-router-dom';
import {afterEach,expect,it,vi} from 'vitest';
import {educationalCaseApi,type PublishedCase} from '@/services/educationalCaseApi';
import {EducationalCasesPage} from './EducationalCasesPage';
vi.mock('@/services/educationalCaseApi',()=>({educationalCaseApi:{published:vi.fn(),publicCase:vi.fn()}}));
afterEach(()=>{cleanup();vi.resetAllMocks();});
const caseData:PublishedCase={id:'test-case',reviewedAt:'2026-09-15T10:00:00Z',publishedAt:'2026-09-15T11:00:00Z',content:{title:'Synthetic lesson',specialty:'RADIOLOGY',scenario:'Invented scenario',originalReport:'Wrong report text',reportingIssue:'Side mismatch',explanation:'Explanation of mismatch',correction:'Corrected report text',syntheticOnly:true}};
it('shows reviewed content and copies only the published URL',async()=>{
 vi.mocked(educationalCaseApi.publicCase).mockResolvedValue(caseData);const user=userEvent.setup();
 render(<MemoryRouter initialEntries={['/cases/test-case']}><Routes><Route path="/cases/:caseId" element={<EducationalCasesPage/>}/></Routes></MemoryRouter>);
 expect(await screen.findByText('Corrected report text')).toBeInTheDocument();expect(screen.getByText('Wrong report text')).toBeInTheDocument();
 await user.click(screen.getByRole('button',{name:'Copy case link'}));expect((screen.getByLabelText('Shareable case link') as HTMLInputElement).value).toContain('/cases/test-case');
});
it('does not invent published cases when the library is empty',async()=>{
 vi.mocked(educationalCaseApi.published).mockResolvedValue([]);render(<MemoryRouter><EducationalCasesPage/></MemoryRouter>);
 expect(await screen.findByText('No published cases on this page')).toBeInTheDocument();expect(screen.queryByText('Corrected report text')).not.toBeInTheDocument();
});
it('shows withdrawn cases as unavailable',async()=>{
 vi.mocked(educationalCaseApi.publicCase).mockRejectedValue({response:{status:404}});
 render(<MemoryRouter initialEntries={['/cases/withdrawn']}><Routes><Route path="/cases/:caseId" element={<EducationalCasesPage/>}/></Routes></MemoryRouter>);
 expect(await screen.findByRole('alert')).toHaveTextContent('withdrawn');expect(screen.queryByRole('button',{name:'Copy case link'})).not.toBeInTheDocument();
});
