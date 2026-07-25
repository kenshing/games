import Home from './pages/Home'

// 单页面游戏：直接渲染，不用路由。
// 此前 BrowserRouter 只匹配 "/"，部署到子路径（如 GitHub Pages 的
// /games/witch-poison/）时路由失配导致整页空白（黑屏）。
export default function App() {
  return <Home />
}
