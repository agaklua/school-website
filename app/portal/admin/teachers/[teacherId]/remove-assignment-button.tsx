"use client";
import {removeTeachingResponsibility} from "../actions";
export function RemoveAssignmentButton({teacherId,assignmentId}:{teacherId:string;assignmentId:string}) {
  return <form action={removeTeachingResponsibility} onSubmit={event=>{if(!window.confirm("Remove this teaching responsibility? The teacher will lose access to this class roster and its attendance records.")) event.preventDefault();}}><input type="hidden" name="teacher_profile_id" value={teacherId}/><input type="hidden" name="assignment_id" value={assignmentId}/><button className="button button-muted">Remove responsibility</button></form>;
}
