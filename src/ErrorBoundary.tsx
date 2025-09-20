// src/ErrorBoundary.tsx
import React from 'react';
export class ErrorBoundary extends React.Component<{children: React.ReactNode},{hasError:boolean,error:any}> {
  constructor(props:any){ super(props); this.state={hasError:false,error:null}; }
  static getDerivedStateFromError(error:any){ return {hasError:true,error}; }
  componentDidCatch(error:any, info:any){ console.error('ErrorBoundary', error, info); }
  render(){ return this.state.hasError
    ? <div style={{padding:16}}>
        <h2>Something broke in this view</h2>
        <pre style={{whiteSpace:'pre-wrap'}}>{String(this.state.error)}</pre>
      </div>
    : this.props.children; }
}
