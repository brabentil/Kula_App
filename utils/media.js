export function inferMediaTypeFromPost(item = {}) {
  const declared = String(item?.mediaType || item?.fileType || "").toLowerCase();
  if (declared === "video" || declared === "image") {
    return declared;
  }
  const uri = String(item?.picturePath || item?.image || "").toLowerCase();
  if (/\.(mp4|mov|webm|m4v|avi|mkv)(\?|$)/.test(uri)) {
    return "video";
  }
  return "image";
}
