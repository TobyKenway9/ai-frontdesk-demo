export function success(res, payload) {
  return res.status(200).json({
    status: "success",
    ...payload
  });
}

export function error(res, code, message, httpStatus = 400) {
  return res.status(httpStatus).json({
    status: "error",
    code,
    message
  });
}
