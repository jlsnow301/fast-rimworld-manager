import { useAppContext } from '../../context/app-context';

export function ModPreviewFeature() {
	const { closeModPreview, previewMessage, selectedMod, steamPreview } =
		useAppContext();
	if (!selectedMod) return null;

	const lastUpdated = steamPreview?.timeUpdated
		? new Date(steamPreview.timeUpdated * 1000).toLocaleString()
		: null;

	return (
		<section aria-label={`${selectedMod.name} details`} className='mod-preview'>
			<div className='panel-heading'>
				<h3>{selectedMod.name}</h3>
				<button onClick={closeModPreview}>Close</button>
			</div>
			<dl className='preview-fields'>
				<div>
					<dt>Package ID</dt>
					<dd>{selectedMod.packageId}</dd>
				</div>
				<div>
					<dt>Source</dt>
					<dd>{selectedMod.source}</dd>
				</div>
				<div>
					<dt>Installed path</dt>
					<dd>{selectedMod.path}</dd>
				</div>
				{selectedMod.publishedFileId && (
					<div>
						<dt>Steam Workshop ID</dt>
						<dd>{selectedMod.publishedFileId}</dd>
					</div>
				)}
			</dl>
			{selectedMod.description && (
				<div>
					<h4>About this mod</h4>
					<p className='preview-description'>{selectedMod.description}</p>
				</div>
			)}
			{steamPreview && (
				<div>
					<h4>Steam Workshop</h4>
					<p>{steamPreview.title}</p>
					{lastUpdated && <p>Last updated {lastUpdated}</p>}
					{steamPreview.previewUrl && (
						<img
							className='steam-preview-image'
							src={steamPreview.previewUrl}
							alt={`Steam Workshop preview for ${steamPreview.title}`}
						/>
					)}
					{steamPreview.description && (
						<p className='preview-description'>
							{steamPreview.description}
						</p>
					)}
				</div>
			)}
			<p aria-live='polite' className='status-message'>{previewMessage}</p>
		</section>
	);
}
