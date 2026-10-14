import React from "react"
import ReactDOM from "react-dom/client"
import { BrowserRouter } from "react-router"
import App from "./App"
import SiteMetadata from "./SiteMetadata"
import "./styles.css"

ReactDOM.createRoot(document.getElementById("root")!).render(
  <BrowserRouter><SiteMetadata /><App /></BrowserRouter>,
)
