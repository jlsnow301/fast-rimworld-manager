import { cn } from 'cn';

function Empty({ className, ...props }: React.ComponentProps<'div'>) {
	return (
		<div
			data-slot='empty'
			className={cn(
				'flex w-full min-w-0 flex-1 flex-col items-center justify-center gap-4 border-dashed p-12 text-center text-balance',
				className,
			)}
			{...props}
		/>
	);
}

function EmptyHeader({ className, ...props }: React.ComponentProps<'div'>) {
	return (
		<div
			data-slot='empty-header'
			className={cn(
				'flex max-w-sm flex-col items-center gap-2',
				className,
			)}
			{...props}
		/>
	);
}

function EmptyTitle({ className, ...props }: React.ComponentProps<'div'>) {
	return (
		<div
			data-slot='empty-title'
			className={cn(
				'font-heading text-lg font-semibold tracking-wider uppercase',
				className,
			)}
			{...props}
		/>
	);
}

function EmptyDescription({ className, ...props }: React.ComponentProps<'p'>) {
	return (
		<div
			data-slot='empty-description'
			className={cn(
				'mt-0.5 text-sm/relaxed text-muted-foreground [&>a]:underline [&>a]:underline-offset-4 [&>a:hover]:text-primary',
				className,
			)}
			{...props}
		/>
	);
}

export { Empty, EmptyDescription, EmptyHeader, EmptyTitle };
