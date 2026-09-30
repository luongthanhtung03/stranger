import type { Icebreaker } from "./events";

const campus = [
  "Kỷ niệm thi cử tệ nhất của bạn là gì?",
  "Quán ăn gần trường nào bạn có thể ăn cả tuần không chán?",
  "Môn học nào làm bạn muốn bỏ học ngay lập tức?",
  "Bạn từng ngủ gật trong lớp chưa? Kể đi!",
  "Thầy/cô nào ở trường bạn 'huyền thoại' nhất?",
  "Bạn học ngành gì và có hối hận không? 😅",
  "Ký túc xá hay ở trọ? Team nào?",
  "Điều gì ở trường bạn mà trường khác không có?",
  "Bạn thường học bài ở đâu: thư viện, quán cà phê hay giường?",
  "Deadline gần nhất của bạn là khi nào? Đã làm chưa?",
  "Lần đầu đi học đại học bạn bị lạc chưa?",
  "Câu lạc bộ nào ở trường bạn thấy thú vị nhất?",
  "Bạn có bao giờ đi nhầm phòng thi chưa?",
  "Nếu được đổi ngành ngay bây giờ, bạn chọn ngành gì?",
  "Bữa ăn 'sinh viên nghèo' đỉnh nhất bạn từng nấu?",
  "Bạn từng cúp học vì lý do gì ngớ ngẩn nhất?",
  "Kỳ thi nào bạn học 1 đêm mà vẫn qua?",
  "Trường bạn có 'truyền thuyết' hay chuyện ma nào không?",
  "Cà phê hay trà sữa để sống sót qua mùa thi?",
  "Bạn thích học sáng sớm hay đêm khuya?",
];

const funny = [
  "Nếu phải chọn một bài hát làm nhạc nền cuộc đời, đó là bài gì?",
  "Biệt danh xấu hổ nhất bạn từng bị gọi?",
  "Điều kỳ lạ nhất bạn từng google?",
  "Bạn giả giọng ai giỏi nhất? Thử đi!",
  "Nếu là một loại đồ ăn, bạn là gì và tại sao?",
  "Món ăn nào bạn thích mà ai cũng chê?",
  "Kể một câu chuyện xấu hổ mà giờ nghĩ lại vẫn buồn cười.",
  "Bạn có tài lẻ nào vô dụng không?",
  "Meme yêu thích nhất của bạn hiện tại?",
  "Nếu có 1 tỷ nhưng phải tiêu hết trong 24 giờ, bạn làm gì?",
  "Bạn đã bao giờ nói dối để trốn một buổi hẹn chưa?",
  "Điều gì làm bạn cười gần đây nhất?",
  "Câu nói cửa miệng của bạn là gì?",
  "Bạn từng nhắn tin nhầm người chưa? Kể đi!",
  "Nếu được đặt tên lại cho chính mình, bạn chọn tên gì?",
  "Bạn ngủ với mấy cái gối?",
  "Bạn hát bài nào khi tắm?",
  "Con vật nào giống bạn nhất?",
  "Bạn giỏi nhất trò gì hồi nhỏ?",
  "Bạn từng bị 'quê' trước crush chưa?",
];

const deep = [
  "Điều gì bạn muốn làm mà chưa dám làm?",
  "Ai là người ảnh hưởng đến bạn nhiều nhất?",
  "Bạn nghĩ mình sẽ ở đâu sau 5 năm nữa?",
  "Một lời khuyên bạn ước nhận được sớm hơn?",
  "Điều gì làm bạn thấy hạnh phúc gần đây?",
  "Bạn có bao giờ cảm thấy lạc lối ở đại học không?",
  "Nếu ngày mai không cần lo tiền, bạn sẽ làm gì?",
  "Bạn sợ điều gì nhất về tương lai?",
  "Kỷ niệm tuổi thơ nào bạn nhớ nhất?",
  "Bạn nghĩ tình bạn đại học có kéo dài mãi không?",
  "Điều gì bạn tự hào nhất về bản thân?",
  "Một thói quen bạn muốn bỏ?",
  "Bạn học được gì từ lần thất bại gần nhất?",
  "Bạn thích ở một mình hay ở giữa đám đông?",
  "Nếu có thể nói chuyện với bản thân lúc 15 tuổi, bạn sẽ nói gì?",
  "Bạn định nghĩa 'thành công' như thế nào?",
  "Quyển sách hay bộ phim nào thay đổi cách bạn nghĩ?",
  "Bạn có đang làm điều mình thực sự thích không?",
  "Điều gì khiến bạn cảm thấy được là chính mình?",
  "Bạn biết ơn điều gì nhất hôm nay?",
];

const wyr = [
  "Bạn chọn: biết trước đề thi hay biết trước tương lai tình yêu?",
  "Bạn chọn: học lại 4 năm đại học hay đi làm ngay từ 18 tuổi?",
  "Bạn chọn: cả đời không dùng điện thoại hay cả đời không ăn đồ ngọt?",
  "Bạn chọn: nói được mọi ngôn ngữ hay chơi được mọi nhạc cụ?",
  "Bạn chọn: luôn đến muộn 10 phút hay luôn đến sớm 2 tiếng?",
  "Bạn chọn: sống ở Hà Nội hay Sài Gòn?",
  "Bạn chọn: có thể bay hay có thể tàng hình?",
  "Bạn chọn: một người bạn thân hay 100 người bạn xã giao?",
  "Bạn chọn: đi du lịch với người lạ hay ở nhà với bạn thân?",
  "Bạn chọn: bị điểm F một môn hay bị crush từ chối công khai?",
  "Bạn chọn: không bao giờ được ngủ nướng hay không bao giờ được ăn khuya?",
  "Bạn chọn: mùa hè mãi mãi hay mùa đông mãi mãi?",
  "Bạn chọn: biết mọi thứ hay hiểu mọi người?",
  "Bạn chọn: tốt nghiệp sớm 1 năm hay có thêm 1 năm gap year?",
  "Bạn chọn: chỉ được nghe 1 bài hát cả đời hay không nghe nhạc nữa?",
  "Bạn chọn: làm việc mình ghét lương cao hay việc mình yêu lương thấp?",
  "Bạn chọn: quay lại 10 năm trước hay nhảy tới 10 năm sau?",
  "Bạn chọn: mất trí nhớ ngắn hạn hay mất trí nhớ dài hạn?",
  "Bạn chọn: ăn phở mỗi ngày hay bún bò mỗi ngày?",
  "Bạn chọn: gọi video với người lạ hay nhắn tin với người lạ? 😏",
];

function build(category: Icebreaker["category"], items: string[]): Icebreaker[] {
  return items.map((text, i) => ({ id: `${category}-${i}`, category, text }));
}

export const ICEBREAKERS: Icebreaker[] = [
  ...build("campus", campus),
  ...build("funny", funny),
  ...build("deep", deep),
  ...build("wyr", wyr),
];
