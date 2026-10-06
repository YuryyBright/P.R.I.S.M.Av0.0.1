from __future__ import annotations
from collections.abc import Awaitable, Callable, Iterable, Sequence
from typing import TypeVar
T=TypeVar("T"); M=TypeVar("M"); R=TypeVar("R")
class MapReduceEngine:
    """Bounded Map/Reduce primitive. It never materializes the complete input unless the caller does."""
    def __init__(self, *, batch_size:int=100):
        if batch_size<1: raise ValueError("batch_size must be positive")
        self.batch_size=batch_size
    async def run(self, items: Iterable[T], mapper: Callable[[Sequence[T]], Awaitable[M]], reducer: Callable[[Sequence[M]], Awaitable[R]]) -> R:
        mapped=[]; batch=[]
        for item in items:
            batch.append(item)
            if len(batch)>=self.batch_size:
                mapped.append(await mapper(tuple(batch))); batch=[]
        if batch: mapped.append(await mapper(tuple(batch)))
        return await reducer(tuple(mapped))
