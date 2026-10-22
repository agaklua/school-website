import {AttendanceWorkspace} from "../../attendance-workspace";
export default function AdminAttendance({searchParams}:{searchParams:Promise<{class_id?:string;school_day?:string;error?:string;saved?:string}>}) { return <AttendanceWorkspace admin searchParams={searchParams}/>; }
