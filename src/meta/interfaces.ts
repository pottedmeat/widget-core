export interface MetaTestCondition<T> {
	(previousValue: T, value: T, key: string): boolean;
}
