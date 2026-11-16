import * as React from "react";
import { motion } from "framer-motion";
import type { SeccionId } from "./common";

const NAV_ASSETS: Partial<Record<SeccionId, string>> = {
  inicio: "data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjQiIGhlaWdodD0iMjQiIHZpZXdCb3g9IjAgMCAyNCAyNCIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj4KPHBhdGggZD0iTTIyLjE4MjkgMTEuODM0TDEzLjEyNjcgMi43ODI0OEwxMi41MTk2IDIuMTc1NDVDMTIuMzgxMyAyLjAzODA1IDEyLjE5NDMgMS45NjA5NCAxMS45OTkzIDEuOTYwOTRDMTEuODA0NCAxLjk2MDk0IDExLjYxNzMgMi4wMzgwNSAxMS40NzkgMi4xNzU0NUwxLjgxNTcyIDExLjgzNEMxLjY3NCAxMS45NzUyIDEuNTYxOTkgMTIuMTQzMyAxLjQ4NjMxIDEyLjMyODVDMS40MTA2MyAxMi41MTM3IDEuMzcyODIgMTIuNzEyMSAxLjM3NTEgMTIuOTEyMkMxLjM4NDQ3IDEzLjczNzIgMi4wNzExOSAxNC4zOTU4IDIuODk2MTkgMTQuMzk1OEgzLjg5MjI4VjIyLjAyOTRIMjAuMTA2M1YxNC4zOTU4SDIxLjEyMzVDMjEuNTI0MyAxNC4zOTU4IDIxLjkwMTcgMTQuMjM4NyAyMi4xODUzIDEzLjk1NTFDMjIuMzI0OSAxMy44MTU5IDIyLjQzNTUgMTMuNjUwNCAyMi41MTA4IDEzLjQ2ODJDMjIuNTg2IDEzLjI4NTkgMjIuNjI0MyAxMy4wOTA2IDIyLjYyMzUgMTIuODkzNEMyMi42MjM1IDEyLjQ5NSAyMi40NjY1IDEyLjExNzYgMjIuMTgyOSAxMS44MzRaTTEzLjMxMTggMjAuMzQxOUgxMC42ODY4VjE1LjU2MDZIMTMuMzExOFYyMC4zNDE5Wk0xOC40MTg4IDEyLjcwODNWMjAuMzQxOUgxNC44MTE4VjE0Ljk5ODFDMTQuODExOCAxNC40ODAxIDE0LjM5MjMgMTQuMDYwNiAxMy44NzQzIDE0LjA2MDZIMTAuMTI0M0M5LjYwNjM1IDE0LjA2MDYgOS4xODY4MiAxNC40ODAxIDkuMTg2ODIgMTQuOTk4MVYyMC4zNDE5SDUuNTc5NzhWMTIuNzA4M0gzLjMyOTc4TDEyLjAwMTcgNC4wNDM0MkwxMi41NDMxIDQuNTg0ODJMMjAuNjcxMiAxMi43MDgzSDE4LjQxODhaIiBmaWxsPSJibGFjayIvPgo8L3N2Zz4K",
  servicios: "data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjQiIGhlaWdodD0iMjQiIHZpZXdCb3g9IjAgMCAyNCAyNCIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj4KPHBhdGggZD0iTTMgNUMzIDQuNDY5NTcgMy4yMTA3MSAzLjk2MDg2IDMuNTg1NzkgMy41ODU3OUMzLjk2MDg2IDMuMjEwNzEgNC40Njk1NyAzIDUgM0gxM0MxMy41MzA0IDMgMTQuMDM5MSAzLjIxMDcxIDE0LjQxNDIgMy41ODU3OUMxNC43ODkzIDMuOTYwODYgMTUgNC40Njk1NyAxNSA1VjEzQzE1IDEzLjUzMDQgMTQuNzg5MyAxNC4wMzkxIDE0LjQxNDIgMTQuNDE0MkMxNC4wMzkxIDE0Ljc4OTMgMTMuNTMwNCAxNSAxMyAxNUg1QzQuNDY5NTcgMTUgMy45NjA4NiAxNC43ODkzIDMuNTg1NzkgMTQuNDE0MkMzLjIxMDcxIDE0LjAzOTEgMyAxMy41MzA0IDMgMTNWNVoiIHN0cm9rZS1saW5lY2FwPSJyb3VuZCIgc3Ryb2tlLWxpbmVqb2luPSJyb3VuZCIgc3Ryb2tlPSIjMUI2QjFBIi8+CjxwYXRoIGQ9Ik05IDExQzkgMTAuNDY5NiA5LjIxMDcxIDkuOTYwODYgOS41ODU3OSA5LjU4NTc5QzkuOTYwODYgOS4yMTA3MSAxMC40Njk2IDkgMTEgOUgxOUMxOS41MzA0IDkgMjAuMDM5MSA5LjIxMDcxIDIwLjQxNDIgOS41ODU3OUMyMC43ODkzIDkuOTYwODYgMjEgMTAuNDY5NiAyMSAxMVYxOUMyMSAxOS41MzA0IDIwLjc4OTMgMjAuMDM5MSAyMC40MTQyIDIwLjQxNDJDMjAuMDM5MSAyMC43ODkzIDE5LjUzMDQgMjEgMTkgMjFIMTFDMTAuNDY5NiAyMSA5Ljk2MDg2IDIwLjc4OTMgOS41ODU3OSAyMC40MTQyQzkuMjEwNzEgMjAuMDM5MSA5IDE5LjUzMDQgOSAxOVYxMVoiIHN0cm9rZS1saW5lY2FwPSJyb3VuZCIgc3Ryb2tlLWxpbmVqb2luPSJyb3VuZCIgc3Ryb2tlPSIjMUI2QjFBIi8+Cjwvc3ZnPgo=",
  clientes: "data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjQiIGhlaWdodD0iMjQiIHZpZXdCb3g9IjAgMCAyNCAyNCIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj4KPHBhdGggZD0iTTMuMDMxMjUgMTguNDlIMTIuOTcxM0MxNi43NDEzIDE4LjQ5IDE4LjYzMTIgMTguNDkgMTkuODAxMiAxNy4zMkMyMC45NzEyIDE2LjE1IDIwLjk3MTIgMTQuMjYgMjAuOTcxMiAxMC40OVY5Ljc1QzIwLjk3MTIgNS45NyAyMC45NzEyIDQuMDkgMTkuODAxMiAyLjkyQzE4LjYzMTIgMS43NSAxNi43NDEzIDEuNzUgMTIuOTcxMyAxLjc1SDExLjAzMTJDNy4yNjEyNSAxLjc1IDUuMzcxMjUgMS43NSA0LjIwMTI1IDIuOTJDMy4wMzEyNSA0LjA5IDMuMDMxMjUgNS45NyAzLjAzMTI1IDkuNzVWMTguNDlaIiBzdHJva2Utd2lkdGg9IjEuNSIgc3Ryb2tlLWxpbmVjYXA9InJvdW5kIiBzdHJva2UtbGluZWpvaW49InJvdW5kIiBzdHJva2U9ImJsYWNrIi8+CjxwYXRoIGQ9Ik0zLjAzMTI1IDE4LjQ5MTlDMy4wMzEyNSAxOS4yMDE5IDMuMDMxMjUgMTkuNTYxOSAzLjA5MTI1IDE5Ljg1MTlDMy4yMDg4MyAyMC40Mjg0IDMuNDkzMzYgMjAuOTU3NiAzLjkwOTQyIDIxLjM3MzdDNC4zMjU0OCAyMS43ODk4IDQuODU0NzEgMjIuMDc0MyA1LjQzMTI1IDIyLjE5MTlDNS43MzEyNSAyMi4yNTE5IDYuMDgxMjUgMjIuMjUxOSA2Ljc5MTI1IDIyLjI1MTlIMTUuMDAxM0MxNi4zMjEyIDIyLjI1MTkgMTYuOTgxMyAyMi4yNTE5IDE3LjUwMTMgMjIuMDUxOUMxNy44ODkzIDIxLjkwMTEgMTguMjQxOCAyMS42NzEyIDE4LjUzNjIgMjEuMzc2OEMxOC44MzA2IDIxLjA4MjQgMTkuMDYwNSAyMC43MyAxOS4yMTEyIDIwLjM0MTlDMTkuNDExMiAxOS44MjE5IDE5LjQxMTIgMTkuMTYxOSAxOS40MTEyIDE3Ljg0MTlNMTQuNzYxMyA4LjE4MTg4QzE0Ljc2MTMgNy40NDk4OCAxNC40NzA1IDYuNzQ3ODYgMTMuOTUyOSA2LjIzMDI2QzEzLjQzNTMgNS43MTI2NiAxMi43MzMyIDUuNDIxODggMTIuMDAxMyA1LjQyMTg4QzExLjI2OTMgNS40MjE4OCAxMC41NjcyIDUuNzEyNjYgMTAuMDQ5NiA2LjIzMDI2QzkuNTMyMDQgNi43NDc4NiA5LjI0MTI1IDcuNDQ5ODggOS4yNDEyNSA4LjE4MTg4QzkuMjQxMjUgOC45MTM4NyA5LjUzMjA0IDkuNjE1ODkgMTAuMDQ5NiAxMC4xMzM1QzEwLjU2NzIgMTAuNjUxMSAxMS4yNjkzIDEwLjk0MTkgMTIuMDAxMyAxMC45NDE5QzEyLjczMzIgMTAuOTQxOSAxMy40MzUzIDEwLjY1MTEgMTMuOTUyOSAxMC4xMzM1QzE0LjQ3MDUgOS42MTU4OSAxNC43NjEzIDguOTEzODcgMTQuNzYxMyA4LjE4MTg4WiIgc3Ryb2tlLXdpZHRoPSIxLjUiIHN0cm9rZS1saW5lY2FwPSJyb3VuZCIgc3Ryb2tlLWxpbmVqb2luPSJyb3VuZCIgc3Ryb2tlPSJibGFjayIvPgo8cGF0aCBkPSJNOC4xMjUgMTQuODE3NUM4LjEyNSAxMy43ODg1IDguNTMzNzggMTIuODAxNiA5LjI2MTQzIDEyLjA3MzlDOS45ODkwNyAxMS4zNDYzIDEwLjk3NiAxMC45Mzc1IDEyLjAwNSAxMC45Mzc1QzEzLjAzNCAxMC45Mzc1IDE0LjAyMDkgMTEuMzQ2MyAxNC43NDg2IDEyLjA3MzlDMTUuNDc2MiAxMi44MDE2IDE1Ljg4NSAxMy43ODg1IDE1Ljg4NSAxNC44MTc1IiBzdHJva2Utd2lkdGg9IjEuNSIgc3Ryb2tlLWxpbmVjYXA9InJvdW5kIiBzdHJva2UtbGluZWpvaW49InJvdW5kIiBzdHJva2U9ImJsYWNrIi8+Cjwvc3ZnPgo=",
  agenda: "data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjQiIGhlaWdodD0iMjQiIHZpZXdCb3g9IjAgMCAyNCAyNCIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj4KPHBhdGggZD0iTTguMTAxNTYgMi4zOTg0NEM4LjYwMDMxIDIuMzk4NDQgOS4wMDE1NiAyLjc5OTY5IDkuMDAxNTYgMy4yOTg0NFY0Ljc5ODQ0SDE1LjAwMTZWMy4yOTg0NEMxNS4wMDE2IDIuNzk5NjkgMTUuNDAyOCAyLjM5ODQ0IDE1LjkwMTYgMi4zOTg0NEMxNi40MDAzIDIuMzk4NDQgMTYuODAxNiAyLjc5OTY5IDE2LjgwMTYgMy4yOTg0NFY0Ljc5ODQ0SDE4LjAwMTZDMTkuMzI1MyA0Ljc5ODQ0IDIwLjQwMTYgNS44NzQ2OSAyMC40MDE2IDcuMTk4NDRWMTcuOTk4NEMyMC40MDE2IDE5LjMyMjIgMTkuMzI1MyAyMC4zOTg0IDE4LjAwMTYgMjAuMzk4NEg2LjAwMTU2QzQuNjc3ODEgMjAuMzk4NCAzLjYwMTU2IDE5LjMyMjIgMy42MDE1NiAxNy45OTg0VjcuMTk4NDRDMy42MDE1NiA1Ljg3NDY5IDQuNjc3ODEgNC43OTg0NCA2LjAwMTU2IDQuNzk4NDRINy4yMDE1NlYzLjI5ODQ0QzcuMjAxNTYgMi43OTk2OSA3LjYwMjgxIDIuMzk4NDQgOC4xMDE1NiAyLjM5ODQ0Wk0xOC4wMDE2IDE4LjU5ODRDMTguMzMxNiAxOC41OTg0IDE4LjYwMTYgMTguMzI4NCAxOC42MDE2IDE3Ljk5ODRWMTUuNTk4NEgxNS4zMDE2VjE4LjU5ODRIMTguMDAxNlpNMTguNjAxNiAxMy43OTg0VjEwLjc5ODRIMTUuMzAxNlYxMy43OTg0SDE4LjYwMTZaTTEzLjUwMTYgMTMuNzk4NFYxMC43OTg0SDEwLjUwMTZWMTMuNzk4NEgxMy41MDE2Wk04LjcwMTU2IDEzLjc5ODRWMTAuNzk4NEg1LjQwMTU2VjEzLjc5ODRIOC43MDE1NlpNNS40MDE1NiAxNS41OTg0VjE3Ljk5ODRDNS40MDE1NiAxOC4zMjg0IDUuNjcxNTYgMTguNTk4NCA2LjAwMTU2IDE4LjU5ODRIOC43MDE1NlYxNS41OTg0SDUuNDAxNTZaTTEwLjUwMTYgMTUuNTk4NFYxOC41OTg0SDEzLjUwMTZWMTUuNTk4NEgxMC41MDE2Wk04LjEwMTU2IDYuNTk4NDRINi4wMDE1NkM1LjY3MTU2IDYuNTk4NDQgNS40MDE1NiA2Ljg2ODQ0IDUuNDAxNTYgNy4xOTg0NFY4Ljk5ODQ0SDE4LjYwMTZWNy4xOTg0NEMxOC42MDE2IDYuODY4NDQgMTguMzMxNiA2LjU5ODQ0IDE4LjAwMTYgNi41OTg0NEg4LjEwMTU2WiIgZmlsbD0iYmxhY2siLz4KPC9zdmc+Cg==",
  horarios: "data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjQiIGhlaWdodD0iMjQiIHZpZXdCb3g9IjAgMCAyNCAyNCIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj4KPHBhdGggZD0iTTE2IDEySDEyVjYiIHN0cm9rZS13aWR0aD0iMS41IiBzdHJva2UtbGluZWNhcD0icm91bmQiIHN0cm9rZS1saW5lam9pbj0icm91bmQiIHN0cm9rZT0iYmxhY2siLz4KPHBhdGggZD0iTTIyIDEyQzIyIDE3LjUyMyAxNy41MjMgMjIgMTIgMjJDNi40NzcgMjIgMiAxNy41MjMgMiAxMkMyIDYuNDc3IDYuNDc3IDIgMTIgMk0xOC44NDggNC4xN0MxOS4xOTY4IDQuNDc3NTIgMTkuNTI1OCA0LjgwNjg0IDE5LjgzMyA1LjE1Nk0xNSAyQzE1LjQ4MjcgMi4xNDMzMyAxNS45NTM3IDIuMzI1NjcgMTYuNDEzIDIuNTQ3TTIxLjQzOCA3LjU1NUMyMS42NjYgOC4wMjQzMyAyMS44NTMzIDguNTA2IDIyIDkiIHN0cm9rZS13aWR0aD0iMS41IiBzdHJva2UtbGluZWNhcD0icm91bmQiIHN0cm9rZS1saW5lam9pbj0icm91bmQiIHN0cm9rZT0iYmxhY2siLz4KPC9zdmc+Cg==",
  pagos: "data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjQiIGhlaWdodD0iMjQiIHZpZXdCb3g9IjAgMCAyNCAyNCIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj4KPHBhdGggZD0iTTQuOTMxNTYgMTQuMjI5TDQuOTMwNTYgMTQuMjMxTDEzLjc2OTYgMjAuMTE3TDE5LjA3MjYgMTYuNTg1TDE5LjA2OTYgMTYuNTgzTDIwLjQ4MzYgMTUuNjQxTDIxLjkwMDYgMTYuNTg1TDEzLjc2OTYgMjIuMDAxTDIuMTAxNTYgMTQuMjMxTDMuNTE3NTYgMTMuMjg2TDQuOTMxNTYgMTQuMjI5Wk00LjkzMTU2IDEwLjgyMUw0LjkzMDU2IDEwLjgyM0wxMy43Njk2IDE2LjcxTDE5LjA3MjYgMTMuMTc4TDE5LjA2OTYgMTMuMTc2TDIwLjQ4MzYgMTIuMjMzTDIxLjkwMDYgMTMuMTc4TDEzLjc2OTYgMTguNTk0TDIuMTAxNTYgMTAuODI0TDMuNTE3NTYgOS44NzlMNC45MzE1NiAxMC44MjFaTTIxLjkwMTYgOS43NzFMMTMuNzY5NiAxNS4xODhMMi4xMDE1NiA3LjQxNkwxMC4yMzI2IDJMMjEuOTAxNiA5Ljc3MVpNMTAuOTM5NiA0LjM1NkMxMC41NzI2IDQuNiA5Ljk5NDU2IDQuNjE2IDkuNjAyNTYgNC40MDJMOS41MjU1NiA0LjM1Nkw1LjYzNTU2IDYuOTQ2QzYuMDI2NTYgNy4yMDYgNi4wMjY1NiA3LjYyOCA1LjYzNTU2IDcuODg4TDEzLjA2MDYgMTIuODMzQzEzLjQ1MDYgMTIuNTczIDE0LjA4NDYgMTIuNTczIDE0LjQ3NTYgMTIuODMzTDE4LjM2NTYgMTAuMjQzQzE3Ljk3NDYgOS45ODMgMTcuOTc0NiA5LjU2MiAxOC4zNjU2IDkuMzAyTDEwLjkzOTYgNC4zNTZaTTE0LjI5ODYgMTAuMzYxQzE0LjY4ODYgMTAuMTAxIDE1LjMyMjYgMTAuMTAxIDE1LjcxMzYgMTAuMzYxQzE2LjEwMzYgMTAuNjIxIDE2LjEwMzYgMTEuMDQzIDE1LjcxMzYgMTEuMzAzQzE1LjMyMzYgMTEuNTYzIDE0LjY4ODYgMTEuNTYzIDE0LjI5ODYgMTEuMzAzQzEzLjkwODYgMTEuMDQzIDEzLjkwODYgMTAuNjIxIDE0LjI5ODYgMTAuMzYxWk0xMC4wNTY2IDcuM0MxMS4xMzA2IDYuNTg1IDEyLjg3MDYgNi41ODUgMTMuOTQ0NiA3LjNDMTUuMDE4NiA4LjAxNSAxNS4wMTg2IDkuMTc0IDEzLjk0NDYgOS44OUMxMi44NzA2IDEwLjYwNiAxMS4xMzA2IDEwLjYwNSAxMC4wNTY2IDkuODlDOC45ODI1NiA5LjE3NCA4Ljk4MjU2IDguMDE1IDEwLjA1NjYgNy4zWk0xMi44ODQ2IDguMDA2QzEyLjM5NjYgNy42ODEgMTEuNjA0NiA3LjY4MSAxMS4xMTY2IDguMDA2QzEwLjYyODYgOC4zMzEgMTAuNjI4NiA4Ljg1OSAxMS4xMTY2IDkuMTg0QzExLjYwNDYgOS41MDkgMTIuMzk2NiA5LjUwOSAxMi44ODQ2IDkuMTg0QzEzLjM3MjYgOC44NTkgMTMuMzcyNiA4LjMzMSAxMi44ODQ2IDguMDA2Wk03LjkzNTU2IDYuMTIxQzguMzI2NTYgNS44NjEgOC45NTk1NiA1Ljg2MSA5LjM1MDU2IDYuMTIxQzkuNzQwNTYgNi4zODEgOS43NDA1NiA2LjgwMyA5LjM1MDU2IDcuMDYzQzguOTYwNTYgNy4zMjMgOC4zMjY1NiA3LjMyMyA3LjkzNjU2IDcuMDYzQzcuNTQ2NTYgNi44MDMgNy41NDU1NiA2LjM4MSA3LjkzNTU2IDYuMTIxWiIgZmlsbD0iYmxhY2siLz4KPC9zdmc+Cg==",
  finanzas: "data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjQiIGhlaWdodD0iMjQiIHZpZXdCb3g9IjAgMCAyNCAyNCIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj4KPG1hc2sgaWQ9InN0cm9rZTBfMjc1OV84NiIgZmlsbD0id2hpdGUiPgo8cGF0aCBkPSJNNiAyMy4yNUgyLjI1VjE0LjI1SDZWMjMuMjVaTTE2LjUgMjMuMjVIMTIuNzVWOS43NUgxNi41VjIzLjI1Wk0yMS43NSAyMy4yNUgxOFY0LjVIMjEuNzVWMjMuMjVaTTExLjI1IDIzLjI1SDcuNVYwLjc1SDExLjI1VjIzLjI1WiIvPgo8L21hc2s+CjxwYXRoIGQ9Ik02IDIzLjI1SDIuMjVWMTQuMjVINlYyMy4yNVpNMTYuNSAyMy4yNUgxMi43NVY5Ljc1SDE2LjVWMjMuMjVaTTIxLjc1IDIzLjI1SDE4VjQuNUgyMS43NVYyMy4yNVpNMTEuMjUgMjMuMjVINy41VjAuNzVIMTEuMjVWMjMuMjVaIiBzdHJva2Utd2lkdGg9IjIiIHN0cm9rZT0iYmxhY2siIG1hc2s9InVybCgjc3Ryb2tlMF8yNzU5Xzg2KSIvPgo8L3N2Zz4K",
  temas: "data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjQiIGhlaWdodD0iMjQiIHZpZXdCb3g9IjAgMCAyNCAyNCIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj4KPHBhdGggZD0iTTkuMjg2NTYgNC4xNzEyNkM4LjU5OTU2IDMuMTU1NzYgNy44OTYwNiAyLjI5OTI2IDcuMjYxNTYgMS43MDY3NkM2Ljk0NjMyIDEuMzk4NDggNi41ODc0OSAxLjEzODIgNi4xOTY1NiAwLjkzNDI2MkM1Ljg3MTA2IDAuNzc4MjYyIDUuMzU2NTYgMC42MjY3NjIgNC44NzM1NiAwLjkwNDI2MkM0LjMyMzA2IDEuMjIzNzYgNC4yMzMwNiAxLjg0OTI2IDQuMjI4NTYgMi4yNDgyNkM0LjIyNDA2IDIuNzA0MjYgNC4zMjQ1NiAzLjI0NDI2IDQuNDg4MDYgMy44MTQyNkM0Ljc4MjA2IDQuODQ0NzYgNS4zMjIwNiA2LjEwNjI2IDYuMDQwNTYgNy40MTcyNkwxLjEyNjU2IDEyLjMzMTNDMC43MTEwNTkgMTIuNzQ2OCAwLjcyMzA1OSAxMy4zMTUzIDAuNzk5NTU5IDEzLjcwODNDMC44ODIwNTkgMTQuMTMyOCAxLjA4MDA2IDE0LjU5NzggMS4zMzk1NiAxNS4wNjI4QzEuODYxNTYgMTYuMDAzMyAyLjcxOTU2IDE3LjEwNDMgMy43Nzg1NiAxOC4xNjQ4QzQuODM5MDYgMTkuMjI1MyA1Ljk0MDA2IDIwLjA4MTggNi44ODA1NiAyMC42MDM4QzcuMzQ1NTYgMjAuODYzMyA3LjgxMDU2IDIxLjA2MTMgOC4yMzUwNiAyMS4xNDM4QzguNjI4MDYgMjEuMjE4OCA5LjE5NTA2IDIxLjIzMjMgOS42MTIwNiAyMC44MTY4TDE4LjAzNDYgMTIuMzk0M0MxOC4yMTE2IDEyLjc3OTggMTguMTcyNiAxMy4xNjIzIDE4LjEwOTYgMTMuODAyOEMxOC4wNjQ2IDE0LjI0MDggMTguMDA3NiAxNC44MDAzIDE4LjAwMDEgMTUuNTY2OFYxNS43NTEzSDE4LjAwNDZDMTguMDM2IDE2LjEyNjEgMTguMjA3MSAxNi40NzU0IDE4LjQ4MzkgMTYuNzNDMTguNzYwOCAxNi45ODQ2IDE5LjEyMzIgMTcuMTI1OSAxOS40OTkzIDE3LjEyNTlDMTkuODc1NCAxNy4xMjU5IDIwLjIzNzggMTYuOTg0NiAyMC41MTQ3IDE2LjczQzIwLjc5MTUgMTYuNDc1NCAyMC45NjI2IDE2LjEyNjEgMjAuOTk0MSAxNS43NTEzSDIwLjk5ODZWMTUuNjY1OEMyMSAxNS42MDcyIDIwLjk5OCAxNS41NDg2IDIwLjk5MjYgMTUuNDkwM0MyMC45MTAxIDEzLjYxNTMgMTkuOTQyNiAxMS4zODMzIDE4LjIwMjYgMTAuMjQ5M0MxOC4xMTAzIDEwLjAyNjEgMTguMDA0NiA5LjgwODY5IDE3Ljg4NjEgOS41OTgyNkMxNy4zNjI2IDguNjU5MjYgMTYuNTA2MSA3LjU1ODI2IDE1LjQ0NTYgNi40OTc3NkMxNC4zODUxIDUuNDM3MjYgMTMuMjg0MSA0LjU3OTI2IDEyLjM0MzYgNC4wNTcyNkMxMS44Nzg2IDMuNzk5MjYgMTEuNDEzNiAzLjYwMTI2IDEwLjk4OTEgMy41MTcyNkMxMC41OTYxIDMuNDQyMjYgMTAuMDI5MSAzLjQzMDI2IDkuNjEyMDYgMy44NDU3Nkw5LjI4NjU2IDQuMTcxMjZaTTYuMjM4NTYgMi44MDE3NkM2LjgxMDA2IDMuMzM1NzYgNy41MDQ1NiA0LjE4NDc2IDguMjA1MDYgNS4yNDk3Nkw3LjE0OTA2IDYuMzA3MjZDNi41NzYwNiA1LjIxNjc2IDYuMTU5MDYgNC4yMDQyNiA1LjkyOTU2IDMuNDAwMjZDNS44MjkxOSAzLjA3MTUgNS43NjMzMyAyLjczMzE3IDUuNzMzMDYgMi4zOTA3NkM1Ljg3MDA2IDIuNDgwNzYgNi4wMzg1NiAyLjYxNzc2IDYuMjM4NTYgMi44MDE3NlpNNi44Mjk1NiA4Ljc0OTI2QzcuNjM5NTYgMTAuMDI3MyA4LjQ5MDA2IDExLjA5OTggOS4yNDAwNiAxMS43OTg4QzkuMzEyMTUgMTEuODY1OSA5LjM5Njc4IDExLjkxODIgOS40ODkwOSAxMS45NTI3QzkuNTgxNCAxMS45ODcyIDkuNjc5NiAxMi4wMDMxIDkuNzc4MDggMTEuOTk5NkM5Ljg3NjU1IDExLjk5NjIgOS45NzMzOCAxMS45NzMzIDEwLjA2MyAxMS45MzI0QzEwLjE1MjcgMTEuODkxNSAxMC4yMzM0IDExLjgzMzQgMTAuMzAwNiAxMS43NjEzQzEwLjM2NzcgMTEuNjg5MiAxMC40MiAxMS42MDQ1IDEwLjQ1NDUgMTEuNTEyMkMxMC40ODkgMTEuNDE5OSAxMC41MDQ5IDExLjMyMTcgMTAuNTAxNCAxMS4yMjMyQzEwLjQ5OCAxMS4xMjQ4IDEwLjQ3NTEgMTEuMDI3OSAxMC40MzQyIDEwLjkzODNDMTAuMzkzMyAxMC44NDg2IDEwLjMzNTIgMTAuNzY3OSAxMC4yNjMxIDEwLjcwMDhDOS41ODM1NiAxMC4wNjc4IDguNzM3NTYgOC45OTY3NiA3LjkxNzA2IDcuNjYwMjZMOS41NDkwNiA2LjAyODI2QzkuNjMwMDYgNi4yMDkyNiA5LjcyMTU2IDYuMzkxNzYgOS44MjM1NiA2LjU3NTc2QzEwLjM0NzEgNy41MTYyNiAxMS4yMDM2IDguNjE3MjYgMTIuMjY0MSA5LjY3Nzc2QzEzLjMyMzEgMTAuNzM4MyAxNC40MjQxIDExLjU5NDggMTUuMzY2MSAxMi4xMTY4QzE1LjU0OTEgMTIuMjE5OCAxNS43MzE2IDEyLjMxMTMgMTUuOTEzNiAxMi4zOTEzTDguNjIyMDYgMTkuNjg0M0w4LjUyMDA2IDE5LjY2OTNDOC4zMTQ1NiAxOS42Mjg4IDguMDA3MDYgMTkuNTEzMyA3LjYwODA2IDE5LjI5MTNDNi44MjIwNiAxOC44NTMzIDUuODI5MDYgMTguMDkxMyA0LjgzOTA2IDE3LjEwMTNDMy44NDkwNiAxNi4xMTEzIDMuMDg3MDYgMTUuMTIxMyAyLjY0OTA2IDE0LjMzMjNDMi40Mjg1NiAxMy45MzQ4IDIuMzExNTYgMTMuNjI3MyAyLjI3MjU2IDEzLjQyMThMMi4yNTc1NiAxMy4zMTk4TDYuODI5NTYgOC43NDkyNlpNMTEuMTM0NiA1Ljg0Njc2QzEwLjk3ODcgNS41ODI4IDEwLjg1NzIgNS4zMDAwMSAxMC43NzMxIDUuMDA1MjZDMTAuOTc1NiA1LjA1NDc2IDExLjI1OTEgNS4xNzAyNiAxMS42MTYxIDUuMzY2NzZDMTIuNDAyMSA1LjgwNDc2IDEzLjM5NTEgNi41NjY3NiAxNC4zODUxIDcuNTU2NzZDMTUuMDYwMSA4LjIzMTc2IDE1LjYzMDEgOC45MDgyNiAxNi4wNjIxIDkuNTIxNzZDMTUuNTI1MiA5LjQ4NTA1IDE0Ljk4NTkgOS41MzEwOSAxNC40NjMxIDkuNjU4MjZDMTQuMDY3IDkuMzI5MjQgMTMuNjg2NiA4Ljk4MTg2IDEzLjMyMzEgOC42MTcyNkMxMi4zMzMxIDcuNjI3MjYgMTEuNTcyNiA2LjYzNDI2IDExLjEzNjEgNS44NDY3NkgxMS4xMzQ2WiIgZmlsbD0iYmxhY2siLz4KPC9zdmc+Cg==",
  equipo: "data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjQiIGhlaWdodD0iMjQiIHZpZXdCb3g9IjAgMCAyNCAyNCIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj4KPHBhdGggZD0iTTE1IDdDMTUgOC42NTY4NSAxMy42NTY5IDEwIDEyIDEwQzEwLjM0MzEgMTAgOSA4LjY1Njg1IDkgN0M5IDUuMzQzMTUgMTAuMzQzMSA0IDEyIDRDMTMuNjU2OSA0IDE1IDUuMzQzMTUgMTUgN1oiIHN0cm9rZS13aWR0aD0iMS41IiBzdHJva2UtbGluZWNhcD0icm91bmQiIHN0cm9rZS1saW5lam9pbj0icm91bmQiIHN0cm9rZT0iYmxhY2siLz4KPHBhdGggZD0iTTYgNi41QzUuNDAzMjYgNi41IDQuODMwOTcgNi43MzcwNSA0LjQwOTAxIDcuMTU5MDFDMy45ODcwNSA3LjU4MDk3IDMuNzUgOC4xNTMyNiAzLjc1IDguNzVDMy43NSA5LjM0Njc0IDMuOTg3MDUgOS45MTkwMyA0LjQwOTAxIDEwLjM0MUM0LjgzMDk3IDEwLjc2MjkgNS40MDMyNiAxMSA2IDExTTE4IDYuNUMxOC41OTY3IDYuNSAxOS4xNjkgNi43MzcwNSAxOS41OTEgNy4xNTkwMUMyMC4wMTI5IDcuNTgwOTcgMjAuMjUgOC4xNTMyNiAyMC4yNSA4Ljc1QzIwLjI1IDkuMzQ2NzQgMjAuMDEyOSA5LjkxOTAzIDE5LjU5MSAxMC4zNDFDMTkuMTY5IDEwLjc2MjkgMTguNTk2NyAxMSAxOCAxMU00Ljc1IDE0LjI1QzMuNTUgMTQuNjUgMi43NSAxNS42NSAyLjc1IDE2LjlWMTguNUMyLjc1IDE4LjY5ODkgMi44MjkwMiAxOC44ODk3IDIuOTY5NjcgMTkuMDMwM0MzLjExMDMyIDE5LjE3MSAzLjMwMTA5IDE5LjI1IDMuNSAxOS4yNUg0LjVNMTkuMjUgMTQuMjVDMjAuNDUgMTQuNjUgMjEuMjUgMTUuNjUgMjEuMjUgMTYuOVYxOC41QzIxLjI1IDE4LjY5ODkgMjEuMTcxIDE4Ljg4OTcgMjEuMDMwMyAxOS4wMzAzQzIwLjg4OTcgMTkuMTcxIDIwLjY5ODkgMTkuMjUgMjAuNSAxOS4yNUgxOS41TTcgMjAuMjVIMTdDMTcuMTk4OSAyMC4yNSAxNy4zODk3IDIwLjE3MSAxNy41MzAzIDIwLjAzMDNDMTcuNjcxIDE5Ljg4OTcgMTcuNzUgMTkuNjk4OSAxNy43NSAxOS41QzE3Ljc1IDE2LjggMTUuMTUgMTQuNzUgMTIgMTQuNzVDOC44NSAxNC43NSA2LjI1IDE2LjggNi4yNSAxOS41QzYuMjUgMTkuNjk4OSA2LjMyOTAyIDE5Ljg4OTcgNi40Njk2NyAyMC4wMzAzQzYuNjEwMzIgMjAuMTcxIDYuODAxMDkgMjAuMjUgNyAyMC4yNVoiIHN0cm9rZS13aWR0aD0iMS41IiBzdHJva2UtbGluZWNhcD0icm91bmQiIHN0cm9rZS1saW5lam9pbj0icm91bmQiIHN0cm9rZT0iYmxhY2siLz4KPC9zdmc+Cg==",
  perfil: "data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjQiIGhlaWdodD0iMjQiIHZpZXdCb3g9IjAgMCAyNCAyNCIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj4KPHBhdGggZD0iTTE1LjgxOTcgMTEuMzk4MUMxNS44MTk3IDEwLjM4NSAxNS40MTcyIDkuNDEzMzcgMTQuNzAwOCA4LjY5Njk4QzEzLjk4NDQgNy45ODA1OSAxMy4wMTI4IDcuNTc4MTMgMTEuOTk5NyA3LjU3ODEyQzEwLjk4NjYgNy41NzgxMyAxMC4wMTQ5IDcuOTgwNTkgOS4yOTg1NCA4LjY5Njk4QzguNTgyMTUgOS40MTMzNyA4LjE3OTY5IDEwLjM4NSA4LjE3OTY5IDExLjM5ODFDOC4xNzk2OSAxMi40MTEzIDguNTgyMTUgMTMuMzgyOSA5LjI5ODU0IDE0LjA5OTNDMTAuMDE0OSAxNC44MTU3IDEwLjk4NjYgMTUuMjE4MSAxMS45OTk3IDE1LjIxODFDMTMuMDEyOCAxNS4yMTgxIDEzLjk4NDQgMTQuODE1NyAxNC43MDA4IDE0LjA5OTNDMTUuNDE3MiAxMy4zODI5IDE1LjgxOTcgMTIuNDExMyAxNS44MTk3IDExLjM5ODFaIiBzdHJva2Utd2lkdGg9IjEuNSIgc3Ryb2tlLWxpbmVjYXA9InJvdW5kIiBzdHJva2UtbGluZWpvaW49InJvdW5kIiBzdHJva2U9ImJsYWNrIi8+CjxwYXRoIGQ9Ik02LjA3ODEyIDIxLjE0MDlDNi4wNzgxMiAxOS41Njk1IDYuNzAyMzYgMTguMDYyNSA3LjgxMzUyIDE2Ljk1MTNDOC45MjQ2NyAxNS44NDAyIDEwLjQzMTcgMTUuMjE1OSAxMi4wMDMxIDE1LjIxNTlDMTMuNTc0NSAxNS4yMTU5IDE1LjA4MTYgMTUuODQwMiAxNi4xOTI3IDE2Ljk1MTNDMTcuMzAzOSAxOC4wNjI1IDE3LjkyODEgMTkuNTY5NSAxNy45MjgxIDIxLjE0MDlNMTkuMzM4MSAxLjQ2MDk0QzE5LjMzODEgMi45NjA5NCAxNy43MTgxIDQuNTkwOTQgMTYuMjA4MSA0LjU5MDk0QzE3LjcwODEgNC41OTA5NCAxOS4zMzgxIDYuMjQwOTQgMTkuMzM4MSA3LjcyMDk0QzE5LjMzODEgNi4yMjA5NCAyMC45NzgxIDQuNTkwOTQgMjIuNDY4MSA0LjU5MDk0QzIwLjk1ODEgNC41OTA5NCAxOS4zMzgxIDIuOTYwOTQgMTkuMzM4MSAxLjQ2MDk0WiIgc3Ryb2tlLXdpZHRoPSIxLjUiIHN0cm9rZS1saW5lY2FwPSJyb3VuZCIgc3Ryb2tlLWxpbmVqb2luPSJyb3VuZCIgc3Ryb2tlPSJibGFjayIvPgo8cGF0aCBkPSJNMTIuNTAxOSAyLjYwMTU2SDEwLjQyMTlDNi42NTE4OCAyLjYwMTU2IDQuNzYxODcgMi42MDE1NiAzLjU5MTg3IDMuNzcxNTZDMi40MjE4OCA0Ljk0MTU2IDIuNDIxODggNi44MzE1NiAyLjQyMTg4IDEwLjYwMTZWMTMuNzcxNkMyLjQyMTg4IDE3LjU0MTYgMi40MjE4OCAxOS40MjE2IDMuNTkxODcgMjAuNjAxNkM0Ljc1MjA4IDIxLjc3MTcgNi42MjAyOSAyMS43NzE2IDEwLjMyNzYgMjEuNzcxNkgxMC40MjE5SDEzLjU4MTlDMTcuMzUxOSAyMS43NzE2IDE5LjI0MTkgMjEuNzcxNiAyMC40MTE5IDIwLjYwMTZDMjEuNTgxOSAxOS40MjE2IDIxLjU4MTkgMTcuNTQxNiAyMS41ODE5IDEzLjc3MTZWMTEuMTAxNiIgc3Ryb2tlLXdpZHRoPSIxLjUiIHN0cm9rZS1saW5lY2FwPSJyb3VuZCIgc3Ryb2tlLWxpbmVqb2luPSJyb3VuZCIgc3Ryb2tlPSJibGFjayIvPgo8L3N2Zz4K",
};

const NAV_ICONS: Record<SeccionId, React.ReactElement> = {
  perfil: (
    <>
      <rect x="4" y="3" width="16" height="18" rx="3" />
      <circle cx="12" cy="9" r="2.5" />
      <path d="M8 17c0-4 8-4 8 0" />
    </>
  ),
  inicio: (
    <path d="M4 11.5 12 4l8 7.5M6 10v9a1 1 0 0 0 1 1h3v-6h4v6h3a1 1 0 0 0 1-1v-9" />
  ),
  servicios: (
    <>
      <rect x="4" y="4" width="10" height="10" rx="1.5" />
      <rect x="10" y="10" width="10" height="10" rx="1.5" />
    </>
  ),
  consultas: (
    <>
      <path d="M20 11.5a7.5 7.5 0 0 1-7.5 7.5H6l-3 2v-6.5A7.5 7.5 0 1 1 20 11.5Z" />
      <path d="M8 11h8M8 14.5h5" />
    </>
  ),
  clientes: (
    <>
      <rect x="3.5" y="3.5" width="17" height="17" rx="4" />
      <circle cx="12" cy="9" r="2.7" />
      <path d="M7.5 18c.4-2.4 2-3.7 4.5-3.7s4.1 1.3 4.5 3.7" />
    </>
  ),
  agenda: (
    <>
      <rect x="3.5" y="5" width="17" height="15.5" rx="3" />
      <path d="M3.5 10h17M8 3v4M16 3v4" />
      <circle cx="8.2" cy="14.2" r="1" />
      <circle cx="12" cy="14.2" r="1" />
      <circle cx="15.8" cy="14.2" r="1" />
    </>
  ),
  horarios: (
    <>
      <circle cx="12" cy="12.5" r="8.2" />
      <path d="M12 8v4.7l3.2 2" />
    </>
  ),
  pagos: (
    <>
      <path d="m12 3 9 5-9 5-9-5 9-5Z" />
      <path d="m3 12 9 5 9-5M3 16l9 5 9-5" />
    </>
  ),
  finanzas: (
    <>
      <path d="M4 20V10h3v10M10.5 20V4h3v16M17 20V7h3v13" />
    </>
  ),
  temas: (
    <>
      <path d="m4 19 9.7-9.7M3 21l4.2-1 10.5-10.5a2.8 2.8 0 0 0-4-4L3.2 16Z" />
      <path d="m16.5 4.5 3 3" />
    </>
  ),
  equipo: (
    <>
      <circle cx="8.5" cy="8" r="3" />
      <circle cx="17" cy="9" r="2.3" />
      <path d="M3 20c0-3 2.5-5.3 5.5-5.3S14 17 14 20" />
      <path d="M15.3 14.8c2.6.2 4.7 2.2 4.7 5.2" />
    </>
  ),
};

function AmbientOrbs({ accentColor }: { accentColor: string }) {
  const palette = React.useMemo(
    () => [accentColor, "#16a34a", "#4ade80", "#065f46"],
    [accentColor],
  );
  const orbs = [
    { size: 260, top: "-110px", left: "-90px", dur: 14, phase: 0 },
    { size: 190, top: "60%", left: "-60px", dur: 16, phase: 0.35 },
    { size: 220, top: "-40px", left: "60%", dur: 15, phase: 0.65 },
    { size: 160, top: "80%", left: "70%", dur: 18, phase: 0.9 },
  ];
  return (
    <div
      style={{
        position: "absolute",
        inset: 0,
        overflow: "hidden",
        pointerEvents: "none",
      }}
    >
      {orbs.map((o, i) => (
        <motion.div
          key={i}
          style={{
            position: "absolute",
            width: o.size,
            height: o.size,
            top: o.top,
            left: o.left,
            borderRadius: "50%",
            filter: "blur(46px)",
            mixBlendMode: "normal",
          }}
          animate={{
            background: [
              `radial-gradient(circle at 30% 30%, ${palette[i % palette.length]}66, transparent 70%)`,
              `radial-gradient(circle at 60% 40%, ${palette[(i + 1) % palette.length]}66, transparent 70%)`,
              `radial-gradient(circle at 30% 30%, ${palette[i % palette.length]}66, transparent 70%)`,
            ],
            opacity: [0.45, 0.75, 0.45],
            scale: [1, 1.18, 1],
            x: [0, 22, -14, 0],
            y: [0, -18, 12, 0],
          }}
          // Arrancan todas ya "en movimiento": en vez de un delay antes
          // de empezar (que se veía como una pausa inicial), cada orbe
          // inicia su animación en un punto distinto del ciclo.
          initial={{
            opacity: 0.45 + o.phase * 0.3,
            scale: 1 + o.phase * 0.18,
          }}
          transition={{
            duration: o.dur,
            delay: 0,
            repeat: Infinity,
            ease: "easeInOut",
          }}
        />
      ))}
    </div>
  );
}

function BottomNavIcon({
  id,
  active,
  accentColor,
  onClick,
  navIconos,
  showChevron = false,
  chevronDown = false,
}: {
  id: SeccionId;
  active: boolean;
  accentColor: string;
  onClick: () => void;
  navIconos?: Record<string, string>;
  showChevron?: boolean;
  chevronDown?: boolean;
}) {
  return (
    <motion.button
      className="turnits-bottom-nav-button"
      onClick={onClick}
      whileTap={{ scale: 0.9 }}
      aria-label={id}
      aria-current={active ? "page" : undefined}
      style={{
        border: "none",
        background: active ? "#e3f2e1" : "transparent",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        width: 44,
        height: 44,
        borderRadius: 14,
        cursor: "pointer",
        color: active ? accentColor : "#94a3b8",
        flexShrink: 0,
      }}
    >
      <NavGlyph
        id={id}
        navIconos={navIconos}
        size={22}
        strokeWidth={active ? 2.2 : 1.8}
      />
    </motion.button>
  );
}

function BottomNavMore({
  onClick,
  active = false,
}: {
  onClick: () => void;
  active?: boolean;
}) {
  return (
    <motion.button
      className="turnits-bottom-nav-button"
      onClick={onClick}
      whileTap={{ scale: 0.9 }}
      aria-label="Más opciones"
      aria-current={active ? "page" : undefined}
      style={{
        border: "none",
        background: active ? "#e3f2e1" : "transparent",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        width: 44,
        height: 44,
        borderRadius: 14,
        cursor: "pointer",
        color: active ? "#1a6b1a" : "#94a3b8",
        flexShrink: 0,
      }}
    >
      <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor">
        <circle cx="5" cy="12" r="1.8" />
        <circle cx="12" cy="12" r="1.8" />
        <circle cx="19" cy="12" r="1.8" />
      </svg>
    </motion.button>
  );
}

function BrandMark({
  logoImage,
  logoText,
  width = 128,
  height = 64,
  light = false,
}: {
  logoImage?: string;
  logoText?: string;
  width?: number;
  height?: number;
  light?: boolean;
}) {
  return (
    <div
      style={{
        width,
        height,
        borderRadius: 0,
        flexShrink: 0,
        display: "flex",
        alignItems: "center",
        justifyContent: "flex-start",
        overflow: "hidden",
        background: "transparent",
        border: "none",
        boxSizing: "border-box",
      }}
    >
      {logoImage ? (
        <img
          src={logoImage}
          alt={logoText || "Logo"}
          style={{
            width: "100%",
            height: "100%",
            objectFit: "contain",
            objectPosition: "left center",
          }}
        />
      ) : (
        <span
          style={{
            fontFamily: "'Inter Display', -apple-system, sans-serif",
            fontWeight: 750,
            fontSize: 28,
            color: light ? "#ffffff" : "#111111",
            letterSpacing: "-1px",
            textAlign: "left",
            padding: "0 6px",
          }}
        >
          {logoText || "Logo"}
        </span>
      )}
    </div>
  );
}

function NavGlyph({
  id,
  navIconos,
  size = 18,
  strokeWidth = 1.8,
}: {
  id: SeccionId;
  navIconos?: Record<string, string>;
  size?: number;
  strokeWidth?: number;
}) {
  const customSrc = navIconos?.[id] || NAV_ASSETS[id];
  if (customSrc) {
    // Los íconos subidos se tratan como "máscaras": no importa que la
    // imagen sea un SVG/PNG negro, el color real sale de `currentColor`
    // (heredado del botón padre). Así logramos el mismo efecto "pressed"
    // que el ícono lineal por defecto: gris cuando está inactivo, verde
    // (accentColor) cuando está activo/presionado, con transición suave.
    return (
      <div
        aria-hidden="true"
        style={{
          width: size,
          height: size,
          flexShrink: 0,
          position: "relative",
          backgroundColor: "currentColor",
          WebkitMaskImage: `url(${customSrc})`,
          maskImage: `url(${customSrc})`,
          WebkitMaskSize: "contain",
          maskSize: "contain",
          WebkitMaskRepeat: "no-repeat",
          maskRepeat: "no-repeat",
          WebkitMaskPosition: "center",
          maskPosition: "center",
          transition: "background-color 0.15s ease",
        }}
      />
    );
  }
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      style={{ position: "relative", flexShrink: 0 }}
    >
      {NAV_ICONS[id]}
    </svg>
  );
}

function NavButton({
  item,
  active,
  accentColor,
  onClick,
  navIconos,
  showChevron = false,
  chevronDown = false,
}: {
  item: { id: SeccionId; label: string };
  active: boolean;
  accentColor: string;
  onClick: () => void;
  navIconos?: Record<string, string>;
  showChevron?: boolean;
  chevronDown?: boolean;
}) {
  return (
    <motion.button
      className="turnits-panel-nav-button"
      onClick={onClick}
      whileHover={{ x: active ? 0 : 2 }}
      whileTap={{ scale: 0.97 }}
      aria-current={active ? "page" : undefined}
      style={{
        position: "relative",
        display: "flex",
        alignItems: "center",
        justifyContent: "flex-start",
        gap: 9,
        padding: "9px 12px",
        borderRadius: 12,
        border: "none",
        background: "transparent",
        color: active ? "#176b24" : "#111111",
        fontSize: 16,
        fontWeight: active ? 600 : 500,
        cursor: "pointer",
        textAlign: "left",
        overflow: "hidden",
        fontFamily: "inherit",
      }}
    >
      <NavGlyph id={item.id} navIconos={navIconos} size={22} strokeWidth={1.8} />
      <span style={{ position: "relative", flex: 1 }}>{item.label}</span>
      {showChevron && <svg aria-hidden="true" width="12" height="12" viewBox="0 0 12 12" fill="currentColor"><path d={chevronDown ? "m2 4 4 4 4-4" : "m3 2 4 4-4 4"} /></svg>}
    </motion.button>
  );
}

export {
  NAV_ICONS,
  AmbientOrbs,
  BottomNavIcon,
  BottomNavMore,
  BrandMark,
  NavGlyph,
  NavButton,
};
