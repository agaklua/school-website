import {AttendanceWorkspace} from "../../attendance-workspace";
export default function TeacherAttendance({searchParams}:{searchParams:Promise<{class_id?:string;school_day?:string;error?:string;saved?:string}>}) { return <AttendanceWorkspace admin={false} searchParams={searchParams}/>; }
