"use client";
import MuiTable from "@mui/material/Table";
import MuiTableContainer from "@mui/material/TableContainer";
import MuiTableHead from "@mui/material/TableHead";
import MuiTableBody from "@mui/material/TableBody";
import MuiTableRow from "@mui/material/TableRow";
import MuiTableCell from "@mui/material/TableCell";
import type { ComponentProps } from "react";
export function TableContainer(props: ComponentProps<"div">) {
  return <MuiTableContainer {...props} />;
}
export function Table(props: ComponentProps<"table">) {
  return <MuiTable {...props} />;
}
export function TableHead(props: ComponentProps<"thead">) {
  return <MuiTableHead {...props} />;
}
export function TableBody(props: ComponentProps<"tbody">) {
  return <MuiTableBody {...props} />;
}
export function TableRow(props: ComponentProps<"tr">) {
  return <MuiTableRow hover {...props} />;
}
export function TableCell({ align, ...props }: ComponentProps<"td">) {
  return <MuiTableCell align={align === "char" ? "right" : align} {...props} />;
}
export function TableHeader({ align, ...props }: ComponentProps<"th">) {
  return (
    <MuiTableCell
      align={align === "char" ? "right" : align}
      component="th"
      scope="col"
      {...props}
    />
  );
}
