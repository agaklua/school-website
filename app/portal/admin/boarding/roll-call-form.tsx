"use client";
import { useMemo, useState } from "react";
import { recordBoardingRollCall } from "../../boarding-actions";
type Resident={student_id:string;allocation_id:number;name:string;admission_number:string};
export function RollCallForm({residents,date}:{residents:Resident[];date:string}){
 const [session,setSession]=useState("evening");
 const [states,setStates]=useState<Record<string,{status:string;note:string}>>({});
 const records=useMemo(()=>residents.map(r=>({student_id:r.student_id,allocation_id:r.allocation_id,status:states[r.student_id]?.status||"present",note:states[r.student_id]?.note||""})),[residents,states]);
 return <form action={recordBoardingRollCall} className="boarding-form">
  <label>Roll date<input type="date" name="roll_date" defaultValue={date} max={date} required/></label>
  <label>Session<select name="session" value={session} onChange={e=>setSession(e.target.value)}><option value="evening">Evening</option><option value="morning">Morning</option></select></label>
  <input type="hidden" name="records" value={JSON.stringify(records)}/>
  {residents.length?<div className="table-wrap full"><table className="data-table"><thead><tr><th>Student</th><th>Admission no.</th><th>Status</th><th>Note</th></tr></thead><tbody>{residents.map(r=><tr key={r.student_id}><td>{r.name}</td><td>{r.admission_number}</td><td><label className="sr-only" htmlFor={`roll-${r.student_id}`}>Roll-call status for {r.name}</label><select id={`roll-${r.student_id}`} value={states[r.student_id]?.status||"present"} onChange={e=>setStates(s=>({...s,[r.student_id]:{status:e.target.value,note:s[r.student_id]?.note||""}}))}><option value="present">Present</option><option value="absent">Absent</option><option value="late">Late</option><option value="excused">Excused</option></select></td><td><input aria-label={`Note for ${r.name}`} maxLength={300} value={states[r.student_id]?.note||""} onChange={e=>setStates(s=>({...s,[r.student_id]:{status:s[r.student_id]?.status||"present",note:e.target.value}}))}/></td></tr>)}</tbody></table></div>:<p className="portal-empty full">No residents in your authorized boarding areas.</p>}
  <button className="button button-gold" disabled={!residents.length}>Save {session} roll call</button>
 </form>;
}
