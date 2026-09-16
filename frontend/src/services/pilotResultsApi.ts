import api from './api';
import type {ApiResponse} from '@/types';
export interface PilotResults {
 from:string;to:string;generatedAt:string;trackingSince:string;
 qa:{runs:number;reports:number;alerts:number;ratings:number;useful:number;rated_alerts:number};
 editing:{saves:number;reports:number};
 reporting:{signed:number;edited:number;timed:number;median_minutes:number|null;p90_minutes:number|null};
 adoption:{eligible:number;active:number};daily:{day:string;signed:number}[];
}
export const pilotResultsApi={
 async get(from:string,to:string){return(await api.get<ApiResponse<PilotResults>>('/pilot-results',{params:{from,to}})).data.data;},
 async rate(run:string,issueId:string,useful:boolean){await api.put(`/pilot-results/qa-runs/${run}/rating`,{issueId,useful});},
};
