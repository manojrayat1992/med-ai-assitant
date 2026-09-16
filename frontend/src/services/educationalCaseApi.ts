import axios from 'axios';
import api from './api';
import type {ApiResponse} from '@/types';
export interface EducationalContent {title:string;specialty:'RADIOLOGY'|'LABORATORY';scenario:string;originalReport:string;reportingIssue:string;explanation:string;correction:string;syntheticOnly:boolean}
export interface EducationalDraft {id:string;content:EducationalContent;version:number;status:'DRAFT'|'REVIEWED'|'PUBLISHED';reviewedBy:string|null;reviewedAt:string|null;reviewNote:string|null}
export interface PublishedCase {id:string;content:EducationalContent;reviewedAt:string;publishedAt:string}
export const educationalCaseApi={
 async published(page=0){return (await axios.get<ApiResponse<PublishedCase[]>>('/api/public/educational-cases',{params:{page}})).data.data;},
 async publicCase(id:string){return (await axios.get<ApiResponse<PublishedCase>>(`/api/public/educational-cases/${id}`)).data.data;},
 async drafts(page=0){return (await api.get<ApiResponse<EducationalDraft[]>>('/educational-cases',{params:{page}})).data.data;},
 async create(content:EducationalContent){return (await api.post<ApiResponse<EducationalDraft>>('/educational-cases',{content})).data.data;},
 async edit(draft:EducationalDraft,content:EducationalContent){return (await api.put<ApiResponse<EducationalDraft>>(`/educational-cases/${draft.id}`,{version:draft.version,content})).data.data;},
 async review(draft:EducationalDraft,note:string){return (await api.post<ApiResponse<EducationalDraft>>(`/educational-cases/${draft.id}/review`,{version:draft.version,confirmed:true,note})).data.data;},
 async publish(draft:EducationalDraft){return (await api.post<ApiResponse<EducationalDraft>>(`/educational-cases/${draft.id}/publish`,{version:draft.version})).data.data;},
 async withdraw(draft:EducationalDraft){return (await api.post<ApiResponse<EducationalDraft>>(`/educational-cases/${draft.id}/withdraw`,{version:draft.version})).data.data;},
};
