// Schools a user can pick on the landing page. Optional and unverified for
// the beta; VNU members first since that's where we launch.

export interface School {
  id: string;
  short: string;
  name: string;
}

export const SCHOOLS: School[] = [
  { id: "uet", short: "UET", name: "ĐH Công nghệ – ĐHQGHN" },
  { id: "hus", short: "HUS", name: "ĐH Khoa học Tự nhiên – ĐHQGHN" },
  { id: "ussh", short: "USSH", name: "ĐH KHXH & Nhân văn – ĐHQGHN" },
  { id: "ulis", short: "ULIS", name: "ĐH Ngoại ngữ – ĐHQGHN" },
  { id: "ueb", short: "UEB", name: "ĐH Kinh tế – ĐHQGHN" },
  { id: "ued", short: "UED", name: "ĐH Giáo dục – ĐHQGHN" },
  { id: "vnu-ls", short: "VNU-LS", name: "ĐH Luật – ĐHQGHN" },
  { id: "ump", short: "UMP", name: "ĐH Y Dược – ĐHQGHN" },
  { id: "vju", short: "VJU", name: "ĐH Việt Nhật – ĐHQGHN" },
  { id: "vnu-is", short: "VNU-IS", name: "Trường Quốc tế – ĐHQGHN" },
  { id: "hust", short: "HUST", name: "ĐH Bách khoa Hà Nội" },
  { id: "neu", short: "NEU", name: "ĐH Kinh tế Quốc dân" },
  { id: "ftu", short: "FTU", name: "ĐH Ngoại thương" },
  { id: "hmu", short: "HMU", name: "ĐH Y Hà Nội" },
  { id: "hnue", short: "HNUE", name: "ĐH Sư phạm Hà Nội" },
  { id: "ptit", short: "PTIT", name: "HV Công nghệ Bưu chính Viễn thông" },
  { id: "aof", short: "AOF", name: "HV Tài chính" },
  { id: "tmu", short: "TMU", name: "ĐH Thương mại" },
  { id: "hcmut", short: "HCMUT", name: "ĐH Bách khoa – ĐHQG TP.HCM" },
  { id: "hcmus", short: "HCMUS", name: "ĐH Khoa học Tự nhiên – ĐHQG TP.HCM" },
  { id: "uit", short: "UIT", name: "ĐH Công nghệ Thông tin – ĐHQG TP.HCM" },
  { id: "ueh", short: "UEH", name: "ĐH Kinh tế TP.HCM" },
  { id: "rmit", short: "RMIT", name: "ĐH RMIT Việt Nam" },
  { id: "fpt", short: "FPT", name: "ĐH FPT" },
  { id: "other", short: "Khác", name: "Trường khác" },
];

export const SCHOOL_IDS = SCHOOLS.map((s) => s.id);

export const schoolById = (id: string | null | undefined) => SCHOOLS.find((s) => s.id === id) ?? null;
