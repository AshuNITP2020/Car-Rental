import { useDispatch, useSelector } from 'react-redux'
import type { AppDispatch, RootState } from './store'

/** Typed variants of the react-redux hooks — always use these, never the raw ones. */
export const useAppDispatch = useDispatch.withTypes<AppDispatch>()
export const useAppSelector = useSelector.withTypes<RootState>()
